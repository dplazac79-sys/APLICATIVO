import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/http/errors'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inngest } from '@/lib/inngest/client'

// GET — obtener último análisis
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const proyectoId = req.nextUrl.searchParams.get('proyecto_id')
  if (!proyectoId) return NextResponse.json({ error: 'Falta proyecto_id' }, { status: 400 })

  const admin = createAdminClient()
  const { data } = await admin.from('glosario_roles_analisis')
    .select('*')
    .eq('proyecto_id', proyectoId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ analisis: data })
}

// POST — lanzar nuevo análisis (auto-recolecta roles de todos los documentos del proyecto)
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json() as { proyecto_id: string; organigrama_id?: string }
  if (!body.proyecto_id) return NextResponse.json({ error: 'Falta proyecto_id' }, { status: 400 })

  const admin = createAdminClient()

  // Verificar acceso
  const { data: usuarioDB } = await admin.from('usuario').select('rol').eq('id', user.id).single()
  const esInterno = usuarioDB?.rol === 'super_admin' || usuarioDB?.rol === 'consultor'
  if (!esInterno) {
    const { data: acceso } = await admin.from('usuario_proyecto')
      .select('id').eq('usuario_id', user.id).eq('proyecto_id', body.proyecto_id).maybeSingle()
    if (!acceso) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }

  // Determinar organigrama: usar el indicado o el último disponible
  let organigramaId = body.organigrama_id
  if (!organigramaId) {
    const { data: orgs } = await admin.from('organigrama_cliente')
      .select('id').eq('proyecto_id', body.proyecto_id)
      .eq('estado', 'listo').order('created_at', { ascending: false }).limit(1)
    organigramaId = orgs?.[0]?.id
  }
  if (!organigramaId) {
    return NextResponse.json({ error: 'No hay organigrama procesado. Sube el organigrama primero.' }, { status: 400 })
  }

  // Auto-recolectar roles de TODOS los documentos del proyecto con analisis_ia
  // — el select original pedía un embed `proceso:proceso_id(nombre)`, pero
  // `documento` nunca tuvo una columna proceso_id (no existe esa relación
  // directa; es `proceso.documento_origen_id` la que apunta al revés). Esa
  // consulta le devolvía a Postgrest un error de relación inexistente en
  // TODAS las ejecuciones, y como el `error` de la respuesta nunca se
  // revisaba, `documentos` quedaba `null` en silencio — cero roles
  // recolectados, siempre, para cualquier proyecto. Por eso esta función
  // jamás llegó a generar un análisis real.
  const { data: documentos, error: errDocumentos } = await admin
    .from('documento')
    .select('nombre_archivo, analisis_ia')
    .eq('proyecto_id', body.proyecto_id)
    .eq('estado_procesamiento', 'listo')
    .not('analisis_ia', 'is', null)

  if (errDocumentos) return jsonError(errDocumentos)

  // Agregar roles únicos de todos los documentos
  const rolesMap = new Map<string, { rol: string; descripcion: string; procesos: string[] }>()

  for (const doc of documentos ?? []) {
    const ia = doc.analisis_ia as Record<string, unknown>
    const rolesDoc = ia?.roles_y_responsabilidades as Record<string, unknown> | undefined
    const procesosDocName = doc.nombre_archivo

    // roles_identificados: string[]
    const rolesId = (rolesDoc?.roles_identificados as string[] | undefined) ?? []
    for (const rol of rolesId) {
      if (!rol?.trim()) continue
      const key = rol.toLowerCase().trim()
      if (rolesMap.has(key)) {
        const existing = rolesMap.get(key)!
        if (!existing.procesos.includes(procesosDocName)) existing.procesos.push(procesosDocName)
      } else {
        rolesMap.set(key, { rol: rol.trim(), descripcion: '', procesos: [procesosDocName] })
      }
    }

    // brechas_de_rol: string[] — también los incluimos como roles a cubrir
    const brechas = (rolesDoc?.brechas_de_rol as string[] | undefined) ?? []
    for (const brecha of brechas) {
      if (!brecha?.trim()) continue
      // Extraer el nombre del rol de la brecha (antes del primer ":")
      const nombreRol = brecha.split(':')[0].trim()
      const key = `brecha:${nombreRol.toLowerCase()}`
      if (!rolesMap.has(key)) {
        rolesMap.set(key, { rol: nombreRol, descripcion: brecha, procesos: [procesosDocName] })
      }
    }
  }

  const rolesEnProcesos = Array.from(rolesMap.values()).slice(0, 30) // máx 30 roles para no saturar el prompt

  if (rolesEnProcesos.length === 0) {
    return NextResponse.json({
      error: 'No se encontraron roles en los documentos del proyecto. Procesa los documentos primero.'
    }, { status: 400 })
  }

  // Crear registro de análisis
  const { data: analisis, error } = await admin.from('glosario_roles_analisis').insert({
    proyecto_id:       body.proyecto_id,
    organigrama_id:    organigramaId,
    roles_en_procesos: rolesEnProcesos,
    estado:            'generando',
  }).select().single()

  if (error) return jsonError(error)

  // Disparar job Inngest
  await inngest.send({
    name: 'portal/analizar-glosario-roles',
    data: { analisis_id: analisis.id, proyecto_id: body.proyecto_id },
  })

  return NextResponse.json({ ok: true, analisis_id: analisis.id, roles_detectados: rolesEnProcesos.length })
}

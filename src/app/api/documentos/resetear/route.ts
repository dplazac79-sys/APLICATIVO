import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inngest } from '@/lib/inngest/client'

// POST /api/documentos/resetear
// Body: { ids: string[] }  — resetea esos docs a estado pendiente y relanza el procesamiento
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { ids } = body as { ids?: string[] }
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids requerido' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verificar que todos los docs pertenecen a un proyecto del usuario
  // (tabla real: usuario_proyecto — la referencia anterior a "proyecto_miembro"
  // apuntaba a una tabla inexistente y dejaba este endpoint siempre sin acceso)
  const { data: usuarioInfo } = await admin.from('usuario').select('rol').eq('id', user.id).single()
  const { data: docs } = await admin.from('documento').select('id, proyecto_id').in('id', ids)
  if (!docs) return NextResponse.json({ error: 'No se encontraron documentos' }, { status: 404 })

  let accesibles: string[]
  if (usuarioInfo?.rol === 'super_admin') {
    accesibles = docs.map(d => d.id)
  } else {
    const proyectoIds = Array.from(new Set(docs.map(d => d.proyecto_id)))
    const { data: membresias } = await admin
      .from('usuario_proyecto')
      .select('proyecto_id')
      .eq('usuario_id', user.id)
      .in('proyecto_id', proyectoIds)
    const proyectosConAcceso = new Set((membresias ?? []).map(m => m.proyecto_id))
    accesibles = docs.filter(d => proyectosConAcceso.has(d.proyecto_id)).map(d => d.id)
  }

  if (accesibles.length === 0) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  await admin
    .from('documento')
    .update({
      estado_procesamiento: 'pendiente',
      texto_extraido: null,
      resumen_ejecutivo: null,
      clasificacion: null,
      metadata_ia: null,
    })
    .in('id', accesibles)
    .in('estado_procesamiento', ['procesando', 'pendiente', 'error'])

  // Relanzar el job para cada documento reseteado — antes esto nunca ocurría
  // y el documento quedaba "pendiente" sin que ningún proceso lo recogiera.
  await Promise.all(accesibles.map(documento_id =>
    inngest.send({ name: 'documento/procesar', data: { documento_id, usuario_id: user.id } })
  ))

  return NextResponse.json({ ok: true, reseteados: accesibles.length })
}

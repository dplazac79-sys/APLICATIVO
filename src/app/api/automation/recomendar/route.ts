import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/http/errors'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { generarRecomendaciones } from '@/lib/automation/motor-recomendacion'
import { assertProyectoAccess, requireRole } from '@/lib/auth/tenant'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!(await requireRole(user.id, ['super_admin', 'director_proyecto', 'consultor']))) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await req.json()
  const { proceso_id, simulacion_id } = body

  if (!proceso_id) return NextResponse.json({ error: 'proceso_id requerido' }, { status: 400 })

  const admin = createAdminClient()

  // Cargar proceso
  const { data: proceso } = await admin
    .from('proceso')
    .select('id, nombre, proyecto_id')
    .eq('id', proceso_id)
    .single()
  if (!proceso) return NextResponse.json({ error: 'Proceso no encontrado' }, { status: 404 })

  if (!(await assertProyectoAccess(user.id, proceso.proyecto_id))) {
    return NextResponse.json({ error: 'Sin acceso a este proceso' }, { status: 403 })
  }

  // Cargar artefacto TO-BE del proceso
  const { data: artTobe } = await admin
    .from('artefacto')
    .select('id, contenido')
    .eq('proceso_id', proceso_id)
    .eq('tipo', 'to_be')
    .maybeSingle()

  // Cargar artefacto Dashboard de Brechas
  const { data: artBrechas } = await admin
    .from('artefacto')
    .select('contenido')
    .eq('proceso_id', proceso_id)
    .eq('tipo', 'dashboard_brechas')
    .maybeSingle()

  // Cargar simulación
  let simData: Record<string, unknown> = {}
  if (simulacion_id) {
    const { data: sim } = await admin
      .from('simulacion')
      .select('tipo, resultados_todos, parametros')
      .eq('id', simulacion_id)
      .single()
    if (sim) simData = sim as Record<string, unknown>
  }

  // Cargar proyecto y cliente para obtener industria
  const { data: proyecto } = await admin
    .from('proyecto')
    .select('cliente_id, cliente:cliente_id(industria)')
    .eq('id', proceso.proyecto_id)
    .single()

  const industria = (proyecto?.cliente as { industria?: string } | null)?.industria ?? 'Sin clasificar'

  // Cargar KG snapshot de la industria
  const { data: kgSnapshot } = await admin
    .from('kg_industria_snapshot')
    .select('*')
    .eq('industria', industria)
    .maybeSingle()

  // Extraer contexto de la simulación
  const resultados = simData.resultados_todos as Record<string, Record<string, number>> | null
  const base = resultados?.base ?? {}
  const opt = resultados?.optimista ?? {}

  // Construir resumen legible del TO-BE y brechas
  const tobeResumen = artTobe?.contenido
    ? JSON.stringify(artTobe.contenido).slice(0, 800)
    : 'Proceso TO-BE optimizado con reducción de pasos manuales'

  const brechasResumen = artBrechas?.contenido
    ? JSON.stringify(artBrechas.contenido).slice(0, 600)
    : 'Brechas identificadas entre AS-IS y TO-BE del proceso'

  // Generar recomendaciones con IA
  const recs = await generarRecomendaciones({
    proceso_nombre: proceso.nombre,
    artefacto_tobe_resumen: tobeResumen,
    brechas_resumen: brechasResumen,
    simulacion_tipo: (simData.tipo as string) ?? 'operacional',
    mejora_tiempo_pct: (base.mejora_aplicada_pct as number) ?? 30,
    ftes_liberados: (base.ftes_liberados as number) ?? (opt.ftes_optimizados as number) ?? 1,
    roi_pct: (base.roi_pct as number) ?? 0,
    payback_meses: (base.payback_meses as number) ?? 12,
    industria,
    kg_snapshot: kgSnapshot ?? null,
  })

  // Persistir recomendaciones en BD
  const payload = recs.map(r => ({
    proyecto_id: proceso.proyecto_id,
    proceso_id,
    simulacion_id: simulacion_id ?? null,
    artefacto_tobe_id: artTobe?.id ?? null,
    tipo_automatizacion: r.tipo_automatizacion,
    herramientas: r.herramientas,
    justificacion: [
      r.justificacion,
      r.titulo ? `Título: ${r.titulo}` : '',
      r.beneficio_esperado ? `Beneficio: ${r.beneficio_esperado}` : '',
      r.actividades_automatizables?.length
        ? `Actividades: ${r.actividades_automatizables.join(', ')}`
        : '',
    ].filter(Boolean).join('\n\n'),
    score_impacto: r.score_impacto,
    score_esfuerzo: r.score_esfuerzo,
    estado: 'sugerida',
    creado_por: user.id,
  }))

  const { data: insertadas, error } = await admin
    .from('kg_recomendacion')
    .insert(payload)
    .select()

  if (error) return jsonError(error)

  await registrarAudit({
    accion: 'CREATE',
    entidad: 'kg_recomendacion',
    entidad_id: proceso.proyecto_id,
    detalle: { proceso_id, simulacion_id, count: insertadas?.length },
  })

  return NextResponse.json({ ok: true, recomendaciones: insertadas ?? [] })
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const proyecto_id = searchParams.get('proyecto_id')
  const proceso_id = searchParams.get('proceso_id')

  if (!proyecto_id) return NextResponse.json({ error: 'proyecto_id requerido' }, { status: 400 })

  if (!(await assertProyectoAccess(user.id, proyecto_id))) {
    return NextResponse.json({ error: 'Sin acceso a este proyecto' }, { status: 403 })
  }

  let query = supabase
    .from('kg_recomendacion')
    .select('*')
    .eq('proyecto_id', proyecto_id)
    .order('prioridad', { ascending: false })

  if (proceso_id) query = query.eq('proceso_id', proceso_id)

  const { data, error } = await query
  if (error) return jsonError(error)
  return NextResponse.json({ recomendaciones: data ?? [] })
}

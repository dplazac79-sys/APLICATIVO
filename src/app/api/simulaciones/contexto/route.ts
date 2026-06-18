import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Devuelve KPIs, artefactos y roles del proceso para pre-poblar parámetros
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const proceso_id = searchParams.get('proceso_id')
  const proyecto_id = searchParams.get('proyecto_id')

  if (!proceso_id && !proyecto_id) {
    return NextResponse.json({ error: 'proceso_id o proyecto_id requerido' }, { status: 400 })
  }

  if (proyecto_id) {
    // Listar procesos del proyecto para el selector del formulario
    const { data: procesos } = await supabase
      .from('proceso')
      .select('id, nombre, nivel, tipo')
      .eq('proyecto_id', proyecto_id)
      .eq('estado_oferta', 'aceptado')
      .order('nombre')
    return NextResponse.json({ procesos: procesos ?? [] })
  }

  // Cargar proceso primero para obtener proyecto_id
  const { data: procesoData } = await supabase
    .from('proceso')
    .select('id, nombre, roles_involucrados, metadata_ia, proyecto_id')
    .eq('id', proceso_id!)
    .single()

  if (!procesoData) return NextResponse.json({ error: 'Proceso no encontrado' }, { status: 404 })

  const [{ data: kpisData }, { data: artefactosRaw }] = await Promise.all([
    supabase.from('kpi').select('id, nombre, linea_base, meta, frecuencia').eq('proyecto_id', procesoData.proyecto_id),
    supabase.from('artefacto').select('id, tipo, estado_validacion, contenido').eq('proceso_id', proceso_id!),
  ])

  const artefactosData = artefactosRaw ?? []
  const asis = artefactosData.find(a => a.tipo === 'as_is')
  const tobe = artefactosData.find(a => a.tipo === 'to_be')
  const raci = artefactosData.find(a => a.tipo === 'raci')
  const dashboard = artefactosData.find(a => a.tipo === 'dashboard_brechas')
  const kpiSla = artefactosData.find(a => a.tipo === 'kpi_sla')

  // Datos financieros reales estimados por el consultor en el artefacto KPI-SLA.
  // Si no existen (o vienen en 0), retornamos null para que el formulario pida el valor real
  // en lugar de usar defaults hardcodeados.
  let costo_hora_fte_clp: number | null = null
  let costo_mensual_proceso_clp: number | null = null
  let inversion_estimada_clp: number | null = null
  if (kpiSla?.contenido) {
    const fin = (kpiSla.contenido as Record<string, unknown>).financiero as Record<string, unknown> | undefined
    if (fin) {
      const pick = (k: string): number | null => {
        const v = fin[k]
        return typeof v === 'number' && v > 0 ? v : null
      }
      costo_hora_fte_clp = pick('costo_hora_fte_clp')
      costo_mensual_proceso_clp = pick('costo_mensual_proceso_clp')
      inversion_estimada_clp = pick('inversion_estimada_clp')
    }
  }

  // Extraer parámetros sugeridos desde los datos reales
  const kpisLista = kpisData ?? []
  const primerKpi = kpisLista[0]

  // Mejora estimada desde el Dashboard de Brechas (si existe)
  let mejora_tiempo_pct = 30  // default
  let mejora_throughput_pct = 20
  if (dashboard?.contenido) {
    const db = dashboard.contenido as Record<string, unknown>
    if (typeof db.mejora_tiempo_ciclo_pct === 'number') mejora_tiempo_pct = db.mejora_tiempo_ciclo_pct
    if (typeof db.mejora_throughput_pct === 'number') mejora_throughput_pct = db.mejora_throughput_pct
  }

  // Roles del RACI
  const roles_raci: string[] = []
  if (raci?.contenido) {
    const r = raci.contenido as Record<string, unknown>
    if (Array.isArray(r.roles)) roles_raci.push(...r.roles.map(String))
  }
  const roles_finales = roles_raci.length > 0
    ? roles_raci
    : (procesoData.roles_involucrados ?? [])

  const parametros_sugeridos = {
    operacional: {
      tiempo_ciclo_asis_horas: primerKpi?.linea_base ?? 8,
      throughput_asis_unidades_dia: 10,
      carga_trabajo_asis_ftes: roles_finales.length || 3,
      mejora_tiempo_ciclo_pct: mejora_tiempo_pct,
      mejora_throughput_pct: mejora_throughput_pct,
      multiplicador_custom: 0.6,
    },
    financiera: {
      costo_operacional_mensual_clp: costo_mensual_proceso_clp,
      costo_implementacion_clp: inversion_estimada_clp,
      valor_hora_clp: costo_hora_fte_clp,
      horas_ciclo_dia: Math.min(primerKpi?.linea_base ?? 6, 8),
      dias_laborales_mes: 22,
      mejora_tiempo_ciclo_pct: mejora_tiempo_pct,
      multiplicador_custom: 0.6,
    },
    organizacional: {
      headcount_actual: roles_finales.length || 4,
      roles_involucrados: roles_finales,
      ftes_a_liberar_base: Math.max(1, Math.round((roles_finales.length || 4) * 0.25)),
      roles_nuevos_estimados: ['Analista de proceso digital', 'Automatizador RPA'],
      multiplicador_custom: 0.6,
    },
  }

  return NextResponse.json({
    proceso: procesoData,
    kpis: kpisLista,
    artefactos: {
      asis: asis ? { id: asis.id, tipo: asis.tipo } : null,
      tobe: tobe ? { id: tobe.id, tipo: tobe.tipo } : null,
      raci: raci ? { id: raci.id, tipo: raci.tipo } : null,
      dashboard: dashboard ? { id: dashboard.id, tipo: dashboard.tipo } : null,
    },
    parametros_sugeridos,
  })
}

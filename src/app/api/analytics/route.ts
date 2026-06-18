import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
  if (usuario?.rol !== 'super_admin') {
    return NextResponse.json({ error: 'Solo super_admin puede acceder a Analytics Ejecutivo' }, { status: 403 })
  }

  const admin = createAdminClient()

  const [
    proyectosRes,
    kgSnapshotsRes,
    recomendacionesRes,
    procesosRes,
    riesgosRes,
  ] = await Promise.all([
    admin.from('proyecto').select('id, nombre, estado_general, created_at, cliente_id, cliente:cliente_id(industria)'),
    admin.from('kg_industria_snapshot').select('*').order('proyectos_cerrados', { ascending: false }),
    admin.from('kg_recomendacion').select('tipo_automatizacion, estado, score_impacto, proyecto_id'),
    admin.from('proceso').select('nombre, tipo, estado_oferta, proyecto_id'),
    admin.from('riesgo').select('tipo, probabilidad, impacto, proyecto_id'),
  ])

  const proyectos = proyectosRes.data ?? []
  const snapshots = kgSnapshotsRes.data ?? []
  const recs = recomendacionesRes.data ?? []
  const procesos = procesosRes.data ?? []
  const riesgos = riesgosRes.data ?? []

  // Distribución de industrias
  const industrias: Record<string, number> = {}
  for (const p of proyectos) {
    const ind = (p.cliente as { industria?: string } | null)?.industria ?? 'Sin clasificar'
    industrias[ind] = (industrias[ind] ?? 0) + 1
  }

  // Estado de proyectos
  const estadoProyectos: Record<string, number> = {}
  for (const p of proyectos) {
    estadoProyectos[p.estado_general] = (estadoProyectos[p.estado_general] ?? 0) + 1
  }

  // Automatizaciones más recomendadas
  const tiposAut: Record<string, number> = {}
  for (const r of recs) {
    tiposAut[r.tipo_automatizacion] = (tiposAut[r.tipo_automatizacion] ?? 0) + 1
  }

  // Procesos más recurrentes (por nombre, top 10)
  const nombresProc: Record<string, number> = {}
  for (const p of procesos.filter(p => p.estado_oferta === 'aceptado')) {
    const key = p.nombre.toLowerCase().trim()
    nombresProc[key] = (nombresProc[key] ?? 0) + 1
  }
  const procesosTop = Object.entries(nombresProc)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([nombre, frecuencia]) => ({ nombre, frecuencia }))

  // Riesgos más frecuentes por tipo
  const tiposRiesgo: Record<string, number> = {}
  for (const r of riesgos) {
    const tipo = r.tipo ?? 'sin_tipo'
    tiposRiesgo[tipo] = (tiposRiesgo[tipo] ?? 0) + 1
  }

  // Score promedio de recomendaciones aprobadas
  const recsAprobadas = recs.filter(r => r.estado === 'aprobada')
  const scorePromedio = recsAprobadas.length > 0
    ? recsAprobadas.reduce((s, r) => s + (r.score_impacto ?? 0), 0) / recsAprobadas.length
    : 0

  return NextResponse.json({
    resumen: {
      total_proyectos: proyectos.length,
      proyectos_cerrados: estadoProyectos['cerrado'] ?? 0,
      total_industrias: Object.keys(industrias).length,
      total_recomendaciones: recs.length,
      recomendaciones_aprobadas: recsAprobadas.length,
      score_impacto_promedio: Math.round(scorePromedio * 10) / 10,
    },
    distribucion_industrias: Object.entries(industrias)
      .sort(([, a], [, b]) => b - a)
      .map(([industria, count]) => ({ industria, count })),
    estado_proyectos: estadoProyectos,
    automatizaciones_frecuentes: Object.entries(tiposAut)
      .sort(([, a], [, b]) => b - a)
      .map(([tipo, count]) => ({ tipo, count })),
    procesos_recurrentes: procesosTop,
    riesgos_frecuentes: Object.entries(tiposRiesgo)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([tipo, count]) => ({ tipo, count })),
    knowledge_graph: snapshots,
  })
}

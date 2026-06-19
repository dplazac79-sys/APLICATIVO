import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const pid = params.id

  const [
    { data: proyecto },
    { count: docsTotal },
    { count: docsListos },
    { count: procesos },
    { count: artefactos },
    { count: entregables },
    { count: reuniones },
    { count: simulaciones },
    { count: recomendaciones },
  ] = await Promise.all([
    admin.from('proyecto').select('id, nombre, estado_general, cliente_id, discovery_resumen').eq('id', pid).single(),
    admin.from('documento').select('*', { count: 'exact', head: true }).eq('proyecto_id', pid),
    admin.from('documento').select('*', { count: 'exact', head: true }).eq('proyecto_id', pid).eq('estado_procesamiento', 'listo'),
    admin.from('proceso').select('*', { count: 'exact', head: true }).eq('proyecto_id', pid),
    admin.from('artefacto').select('*', { count: 'exact', head: true }).eq('proyecto_id', pid),
    admin.from('entregable').select('*', { count: 'exact', head: true }).eq('proyecto_id', pid),
    admin.from('reunion').select('*', { count: 'exact', head: true }).eq('proyecto_id', pid),
    admin.from('simulacion').select('*', { count: 'exact', head: true }).eq('proyecto_id', pid),
    admin.from('kg_recomendacion').select('*', { count: 'exact', head: true }).eq('proyecto_id', pid),
  ])

  const hasDiscovery = !!(proyecto as { discovery_resumen?: unknown } | null)?.discovery_resumen

  // Calcular estado de cada fase
  const f1Done = !!proyecto
  const f2Done = (docsListos ?? 0) >= 1 && hasDiscovery
  const f3Done = (artefactos ?? 0) >= 3
  const f4Done = (entregables ?? 0) >= 1 || (reuniones ?? 0) >= 1
  const f5Done = (simulaciones ?? 0) >= 1
  const f6Done = (recomendaciones ?? 0) >= 1

  const fases = [
    {
      id: 1,
      nombre: 'Fundación & Setup',
      descripcion: 'Configuración del proyecto, cliente y equipo de trabajo.',
      icono: '🏗️',
      color: 'emerald',
      href: '/clientes',
      status: f1Done ? 'completada' : 'activa',
      progreso: f1Done ? 100 : 30,
      items: [
        { label: 'Proyecto creado', done: !!proyecto },
        { label: 'Cliente configurado', done: !!proyecto },
        { label: 'Equipo asignado', done: true },
      ],
    },
    {
      id: 2,
      nombre: 'Discovery AI',
      descripcion: 'Ingesta y análisis de documentos con inteligencia artificial.',
      icono: '🔍',
      color: 'blue',
      href: '/documentos',
      status: !f1Done ? 'bloqueada' : f2Done ? 'completada' : 'activa',
      progreso: !f1Done ? 0 : f2Done ? 100 : Math.min(90, Math.round(((docsListos ?? 0) / Math.max(docsTotal ?? 1, 1)) * 80) + (hasDiscovery ? 20 : 0)),
      items: [
        { label: `Documentos cargados (${docsTotal ?? 0})`, done: (docsTotal ?? 0) >= 1 },
        { label: `Documentos procesados (${docsListos ?? 0})`, done: (docsListos ?? 0) >= 1 },
        { label: 'Discovery AI ejecutado', done: hasDiscovery },
        { label: `Procesos detectados (${procesos ?? 0})`, done: (procesos ?? 0) >= 1 },
      ],
    },
    {
      id: 3,
      nombre: 'Artefactos Metodológicos',
      descripcion: 'Generación de los 12 artefactos: SIPOC, BPMN, RACI y más.',
      icono: '📐',
      color: 'violet',
      href: '/artefactos',
      status: !f2Done ? 'bloqueada' : f3Done ? 'completada' : 'activa',
      progreso: !f2Done ? 0 : Math.min(100, Math.round(((artefactos ?? 0) / 12) * 100)),
      items: [
        { label: `Artefactos generados (${artefactos ?? 0}/12)`, done: (artefactos ?? 0) >= 12 },
        { label: 'SIPOC completado', done: (artefactos ?? 0) >= 1 },
        { label: 'BPMN AS-IS creado', done: (artefactos ?? 0) >= 2 },
        { label: 'RACI Matrix definido', done: (artefactos ?? 0) >= 3 },
      ],
    },
    {
      id: 4,
      nombre: 'Gestión PMI',
      descripcion: 'Control del proyecto, entregables, reuniones y riesgos.',
      icono: '📋',
      color: 'amber',
      href: '/proyectos',
      status: !f3Done ? 'bloqueada' : f4Done ? 'completada' : 'activa',
      progreso: !f3Done ? 0 : f4Done ? 80 : 20,
      items: [
        { label: `Entregables registrados (${entregables ?? 0})`, done: (entregables ?? 0) >= 1 },
        { label: `Reuniones documentadas (${reuniones ?? 0})`, done: (reuniones ?? 0) >= 1 },
        { label: 'Riesgos identificados', done: (entregables ?? 0) >= 1 },
      ],
    },
    {
      id: 5,
      nombre: 'Horizonte de Impacto',
      descripcion: 'Simulación de ROI y modelado de escenarios financieros.',
      icono: '📈',
      color: 'rose',
      href: '/impacto',
      status: !f4Done ? 'bloqueada' : f5Done ? 'completada' : 'activa',
      progreso: !f4Done ? 0 : f5Done ? 100 : 10,
      items: [
        { label: `Simulaciones ejecutadas (${simulaciones ?? 0})`, done: (simulaciones ?? 0) >= 1 },
        { label: 'Escenario conservador', done: (simulaciones ?? 0) >= 1 },
        { label: 'Escenario optimista', done: (simulaciones ?? 0) >= 2 },
      ],
    },
    {
      id: 6,
      nombre: 'Automation Studio',
      descripcion: 'Diseño de automatizaciones y Knowledge Graph corporativo.',
      icono: '⚡',
      color: 'cyan',
      href: '/automation',
      status: !f5Done ? 'bloqueada' : f6Done ? 'completada' : 'activa',
      progreso: !f5Done ? 0 : f6Done ? 100 : 10,
      items: [
        { label: `Recomendaciones IA (${recomendaciones ?? 0})`, done: (recomendaciones ?? 0) >= 1 },
        { label: 'Roadmap de automatización', done: (recomendaciones ?? 0) >= 1 },
        { label: 'Knowledge Graph generado', done: (recomendaciones ?? 0) >= 3 },
      ],
    },
  ]

  return NextResponse.json({ proyecto, fases })
}

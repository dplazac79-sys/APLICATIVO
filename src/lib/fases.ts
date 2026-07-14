import { createAdminClient } from '@/lib/supabase/admin'
import { getProcesosAceptadosIds } from '@/lib/domain/procesos'

export type FaseStatus = 'completada' | 'activa' | 'bloqueada'

export type Fase = {
  id: number
  nombre: string
  descripcion: string
  icono: string
  color: string
  href: string
  status: FaseStatus
  progreso: number
  items: { label: string; done: boolean }[]
}

const ROLES_CLIENTE = ['sponsor_cliente', 'usuario_cliente']

export async function getFasesProyecto(pid: string, rol?: string): Promise<{ proyecto: Record<string, unknown> | null; fases: Fase[] }> {
  const admin = createAdminClient()

  const [
    { data: proyecto },
    { count: docsTotal },
    { count: procesos },
    aceptados,
    { count: glosarioRoles },
    { count: entregables },
    { count: reuniones },
    { count: simulaciones },
    { count: recomendaciones },
  ] = await Promise.all([
    admin.from('proyecto').select('id, nombre, estado_general, cliente_id, discovery_resumen').eq('id', pid).single(),
    admin.from('documento').select('*', { count: 'exact', head: true }).eq('proyecto_id', pid),
    admin.from('proceso').select('*', { count: 'exact', head: true }).eq('proyecto_id', pid),
    getProcesosAceptadosIds(pid),
    admin.from('glosario_roles_analisis').select('*', { count: 'exact', head: true }).eq('proyecto_id', pid).eq('estado', 'completado'),
    admin.from('entregable').select('*', { count: 'exact', head: true }).eq('proyecto_id', pid),
    admin.from('reunion').select('*', { count: 'exact', head: true }).eq('proyecto_id', pid),
    admin.from('simulacion').select('*', { count: 'exact', head: true }).eq('proyecto_id', pid),
    admin.from('kg_recomendacion').select('*', { count: 'exact', head: true }).eq('proyecto_id', pid),
  ])

  const procesosAprobados = aceptados.total
  const { count: artefactos } = aceptados.ids.length > 0
    ? await admin.from('artefacto').select('*', { count: 'exact', head: true }).in('proceso_id', aceptados.ids)
    : { count: 0 }

  const hasDiscovery = !!(proyecto as { discovery_resumen?: unknown } | null)?.discovery_resumen

  const f1Done = !!proyecto                                          // Fase 1: Dashboard
  const f2Done = (docsTotal ?? 0) >= 1                              // Fase 2: Centro Documental
  const f3Done = (procesosAprobados ?? 0) >= 1 && (glosarioRoles ?? 0) >= 1 // Fase 3: Process Discovery
  const f4Done = (artefactos ?? 0) >= 8                             // Fase 4: Artefactos (8 por proceso)
  const f5Done = (entregables ?? 0) >= 1 || (reuniones ?? 0) >= 1  // Fase 5: Control Center
  const f6Done = (simulaciones ?? 0) >= 1                           // Fase 6: Simulador de Escenarios
  const f7Done = (recomendaciones ?? 0) >= 1                        // Fase 7: Automation Studio

  const fases: Fase[] = [
    {
      id: 1,
      nombre: 'Dashboard',
      descripcion: 'Vista ejecutiva del proyecto: avance, indicadores y próximos hitos.',
      icono: '📊',
      color: 'emerald',
      href: '/dashboard',
      status: f1Done ? 'completada' : 'activa',
      progreso: f1Done ? 100 : 30,
      items: [
        { label: 'Proyecto configurado', done: !!proyecto },
        { label: 'Equipo asignado', done: !!proyecto },
        { label: 'Objetivos definidos', done: !!proyecto },
      ],
    },
    {
      id: 2,
      nombre: 'Centro Documental',
      descripcion: 'Repositorio oficial del proyecto: sube, visualiza y organiza documentos.',
      icono: '📁',
      color: 'blue',
      href: '/documentos',
      status: !f1Done ? 'bloqueada' : f2Done ? 'completada' : 'activa',
      progreso: !f1Done ? 0 : f2Done ? 100 : 0,
      items: [
        { label: `Documentos cargados (${docsTotal ?? 0})`, done: (docsTotal ?? 0) >= 1 },
        { label: 'Repositorio disponible para el equipo', done: (docsTotal ?? 0) >= 1 },
      ],
    },
    {
      id: 3,
      nombre: 'Process Discovery IA',
      descripcion: 'Descubrimiento automático de procesos, roles y modelado visual.',
      icono: '🔍',
      color: 'violet',
      href: '/discovery',
      status: !f2Done ? 'bloqueada' : f3Done ? 'completada' : 'activa',
      progreso: !f2Done ? 0 : f3Done ? 100 : Math.min(80,
        (hasDiscovery ? 30 : 0) +
        ((procesos ?? 0) > 0 ? 20 : 0) +
        ((procesosAprobados ?? 0) > 0 ? 30 : 0)
      ),
      items: [
        { label: 'Discovery AI ejecutado', done: hasDiscovery },
        { label: `Procesos detectados (${procesos ?? 0})`, done: (procesos ?? 0) >= 1 },
        { label: `Procesos aprobados (${procesosAprobados ?? 0})`, done: (procesosAprobados ?? 0) >= 1 },
        { label: 'Glosario de Roles completado', done: (glosarioRoles ?? 0) >= 1 },
      ],
    },
    {
      id: 4,
      nombre: 'Artefactos',
      descripcion: 'Generación de artefactos metodológicos por proceso aprobado.',
      icono: '📐',
      color: 'amber',
      href: '/artefactos',
      status: !f3Done ? 'bloqueada' : f4Done ? 'completada' : 'activa',
      progreso: !f3Done ? 0 : Math.min(100, Math.round(((artefactos ?? 0) / Math.max((procesosAprobados ?? 1) * 8, 8)) * 100)),
      items: [
        { label: `Artefactos generados (${artefactos ?? 0})`, done: (artefactos ?? 0) >= 8 },
        { label: 'SIPOC completado', done: (artefactos ?? 0) >= 1 },
        { label: 'AS-IS y BPMN', done: (artefactos ?? 0) >= 3 },
        { label: 'RACI y Riesgo-Control', done: (artefactos ?? 0) >= 5 },
      ],
    },
    {
      id: 5,
      nombre: 'Project Control Center',
      descripcion: 'Gestión de entregables, reuniones, hitos y riesgos del proyecto.',
      icono: '📋',
      color: 'teal',
      href: '/proyectos',
      status: !f4Done ? 'bloqueada' : f5Done ? 'completada' : 'activa',
      progreso: !f4Done ? 0 : f5Done ? 80 : 20,
      items: [
        { label: `Entregables registrados (${entregables ?? 0})`, done: (entregables ?? 0) >= 1 },
        { label: `Reuniones documentadas (${reuniones ?? 0})`, done: (reuniones ?? 0) >= 1 },
        { label: 'Cronograma de hitos', done: (entregables ?? 0) >= 1 },
      ],
    },
    {
      id: 6,
      nombre: 'Simulador de Escenarios',
      descripcion: 'Modela escenarios a medida: ROI, impacto operacional y organizacional.',
      icono: '📈',
      color: 'cyan',
      href: '/impacto',
      status: !f5Done ? 'bloqueada' : f6Done ? 'completada' : 'activa',
      progreso: !f5Done ? 0 : f6Done ? 100 : 10,
      items: [
        { label: `Simulaciones ejecutadas (${simulaciones ?? 0})`, done: (simulaciones ?? 0) >= 1 },
        { label: 'Escenario operacional', done: (simulaciones ?? 0) >= 1 },
        { label: 'Escenario financiero (ROI)', done: (simulaciones ?? 0) >= 2 },
      ],
    },
    {
      id: 7,
      nombre: 'Automation Studio',
      descripcion: 'Recomendaciones IA de automatización y roadmap de implementación.',
      icono: '⚡',
      color: 'indigo',
      href: '/automation',
      status: !f6Done ? 'bloqueada' : f7Done ? 'completada' : 'activa',
      progreso: !f6Done ? 0 : f7Done ? 100 : 10,
      items: [
        { label: `Recomendaciones IA (${recomendaciones ?? 0})`, done: (recomendaciones ?? 0) >= 1 },
        { label: 'Roadmap de automatización', done: (recomendaciones ?? 0) >= 1 },
        { label: 'Quick Wins identificados', done: (recomendaciones ?? 0) >= 3 },
      ],
    },
  ]

  // El cliente no tiene acceso a Project Control Center / Simulador de Escenarios /
  // Automation Studio (son páginas internas de AICOUNTS) — mostrarle esas 3 fases
  // como "bloqueadas para siempre" es confuso, así que ve solo las 6 fases que
  // realmente puede visitar, numeradas igual que su sidebar (F1..F6).
  if (rol && ROLES_CLIENTE.includes(rol)) {
    const vDone = (artefactos ?? 0) >= 1 // Fase Versiones: hay al menos un artefacto con historial que revisar

    const fasesCliente: Fase[] = [
      {
        id: 1,
        nombre: 'Centro Documental',
        descripcion: 'Repositorio oficial del proyecto: sube, visualiza y organiza documentos.',
        icono: '📁',
        color: 'blue',
        href: '/documentos',
        status: f2Done ? 'completada' : 'activa',
        progreso: f2Done ? 100 : 0,
        items: [
          { label: `Documentos cargados (${docsTotal ?? 0})`, done: (docsTotal ?? 0) >= 1 },
          { label: 'Repositorio disponible para el equipo', done: (docsTotal ?? 0) >= 1 },
        ],
      },
      {
        id: 2,
        nombre: 'Process Discovery IA',
        descripcion: 'Descubrimiento automático de procesos, roles y modelado visual.',
        icono: '🔍',
        color: 'violet',
        href: '/discovery',
        status: !f2Done ? 'bloqueada' : f3Done ? 'completada' : 'activa',
        progreso: !f2Done ? 0 : f3Done ? 100 : Math.min(80,
          (hasDiscovery ? 30 : 0) +
          ((procesos ?? 0) > 0 ? 20 : 0) +
          ((procesosAprobados ?? 0) > 0 ? 30 : 0)
        ),
        items: [
          { label: 'Discovery AI ejecutado', done: hasDiscovery },
          { label: `Procesos detectados (${procesos ?? 0})`, done: (procesos ?? 0) >= 1 },
          { label: `Procesos aprobados (${procesosAprobados ?? 0})`, done: (procesosAprobados ?? 0) >= 1 },
          { label: 'Glosario de Roles completado', done: (glosarioRoles ?? 0) >= 1 },
        ],
      },
      {
        id: 3,
        nombre: 'Artefactos',
        descripcion: 'Generación de artefactos metodológicos por proceso aprobado.',
        icono: '📐',
        color: 'amber',
        href: '/artefactos',
        status: !f3Done ? 'bloqueada' : f4Done ? 'completada' : 'activa',
        progreso: !f3Done ? 0 : Math.min(100, Math.round(((artefactos ?? 0) / Math.max((procesosAprobados ?? 1) * 8, 8)) * 100)),
        items: [
          { label: `Artefactos generados (${artefactos ?? 0})`, done: (artefactos ?? 0) >= 8 },
          { label: 'SIPOC completado', done: (artefactos ?? 0) >= 1 },
          { label: 'AS-IS y BPMN', done: (artefactos ?? 0) >= 3 },
          { label: 'RACI y Riesgo-Control', done: (artefactos ?? 0) >= 5 },
        ],
      },
      {
        id: 4,
        nombre: 'Control de Versiones',
        descripcion: 'Historial de cambios de procesos y artefactos, con descarga por versión.',
        icono: '🔀',
        color: 'teal',
        href: '/versiones',
        status: !f4Done ? 'bloqueada' : vDone ? 'completada' : 'activa',
        progreso: !f4Done ? 0 : vDone ? 100 : 0,
        items: [
          { label: `Artefactos con historial (${artefactos ?? 0})`, done: (artefactos ?? 0) >= 1 },
        ],
      },
      {
        id: 5,
        nombre: 'Horizonte de Impacto',
        descripcion: 'Simulación del impacto de negocio esperado del proyecto.',
        icono: '📈',
        color: 'cyan',
        href: '/horizonte',
        // Cada simulación se genera al vuelo y no queda guardada en ninguna tabla,
        // así que no existe forma real de saber si el cliente ya la usó antes —
        // se muestra disponible una vez desbloqueada, pero nunca "completada".
        status: !vDone ? 'bloqueada' : 'activa',
        progreso: !vDone ? 0 : 10,
        items: [
          { label: 'Procesos y artefactos aprobados listos para simular', done: vDone },
        ],
      },
      {
        id: 6,
        nombre: 'Dashboard',
        descripcion: 'Vista ejecutiva del proyecto: avance, indicadores y próximos hitos.',
        icono: '📊',
        color: 'emerald',
        href: '/dashboard',
        // Vista de resumen, no un paso de trabajo — siempre disponible, sin bloqueo.
        status: 'completada',
        progreso: 100,
        items: [
          { label: 'Proyecto configurado', done: !!proyecto },
          { label: 'Equipo asignado', done: !!proyecto },
          { label: 'Objetivos definidos', done: !!proyecto },
        ],
      },
    ]

    return { proyecto: proyecto as Record<string, unknown> | null, fases: fasesCliente }
  }

  return { proyecto: proyecto as Record<string, unknown> | null, fases }
}

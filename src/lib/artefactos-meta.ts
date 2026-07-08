import type { TipoArtefacto } from '@/types/database'

export const ORDEN_GENERACION: TipoArtefacto[] = [
  'sipoc',
  'as_is',
  'bpmn',
  'raci',
  'riesgo_control',
  'kpi_sla',
  'diagnostico',
  'to_be',
]

export const LABEL_ARTEFACTO: Record<TipoArtefacto, string> = {
  sipoc: 'SIPOC',
  as_is: 'AS-IS',
  bpmn: 'BPMN',
  historias_usuario: 'Historias de Usuario',
  flujograma: 'Flujograma',
  raci: 'RACI',
  riesgo_control: 'Riesgo-Control',
  kpi_sla: 'KPI-SLA',
  diagnostico: 'Diagnóstico',
  to_be: 'TO-BE',
  dashboard_brechas: 'Dashboard de Brechas',
  cierre_ejecutivo: 'Cierre Ejecutivo',
  checklist: 'Checklists por Rol',
  backlog: 'Backlog Priorizado',
  cinco_porques: '5 Porqués',
  acta_inicio: 'Acta de Inicio',
  plan_pruebas: 'Plan de Pruebas',
  roadmap: 'Roadmap de Implementación',
}

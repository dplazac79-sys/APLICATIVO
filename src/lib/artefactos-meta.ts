import type { TipoArtefacto } from '@/types/database'

export const ORDEN_GENERACION: TipoArtefacto[] = [
  'sipoc',
  'as_is',
  'bpmn',
  'historias_usuario',
  'flujograma',
  'raci',
  'riesgo_control',
  'kpi_sla',
  'diagnostico',
  'to_be',
  'dashboard_brechas',
  'cierre_ejecutivo',
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
}

export type TipoAutomatizacion = 'RPA' | 'integracion' | 'ia_generativa' | 'workflow' | 'hibrida'
export type EstadoRecomendacion = 'sugerida' | 'aprobada' | 'descartada'
export type EstadoRoadmap = 'borrador' | 'aprobado' | 'exportado'

export interface RecomendacionAutomatizacion {
  id: string
  proyecto_id: string
  proceso_id: string | null
  simulacion_id: string | null
  artefacto_tobe_id: string | null
  tipo_automatizacion: TipoAutomatizacion
  herramientas: string[]
  justificacion: string
  score_impacto: number
  score_esfuerzo: number
  prioridad: number
  estado: EstadoRecomendacion
  roadmap_id: string | null
  creado_por: string | null
  created_at: string
  updated_at: string
  // campos enriquecidos del prompt
  titulo?: string
  actividades_automatizables?: string[]
  beneficio_esperado?: string
  riesgos_implementacion?: string[]
  referencias_tobe?: string[]
}

export interface Roadmap {
  id: string
  proyecto_id: string
  nombre: string
  descripcion: string | null
  estado: EstadoRoadmap
  entregable_id: string | null
  creado_por: string | null
  created_at: string
  updated_at: string
  recomendaciones?: RecomendacionAutomatizacion[]
}

export interface KgIndustriaSnapshot {
  id: string
  industria: string
  procesos_frecuentes: KgPatronItem[]
  riesgos_frecuentes: KgPatronItem[]
  kpis_frecuentes: KgPatronItem[]
  automatizaciones: KgAutomatizacionPatron[]
  proyectos_cerrados: number
  updated_at: string
}

export interface KgPatronItem {
  nombre: string
  frecuencia: number
  tipo?: string
}

export interface KgAutomatizacionPatron {
  tipo: TipoAutomatizacion
  herramientas: string[]
  frecuencia: number
  score_promedio: number
}

// ── Knowledge Graph relacional (nodos + relaciones) ─────────────────────────
export type KgNodoTipo = 'proceso' | 'riesgo' | 'kpi' | 'automatizacion' | 'herramienta' | 'rol'
export type KgTipoRelacion = 'usa' | 'genera' | 'mitiga' | 'requiere' | 'produce' | 'causa'

export interface KgNodo {
  id: string
  industria: string
  tipo: KgNodoTipo
  nombre: string
  metadata: Record<string, unknown>
  frecuencia: number
}

export interface KgRelacion {
  id: string
  nodo_origen: string
  nodo_destino: string
  tipo_relacion: KgTipoRelacion
  peso: number
}

// Relación enriquecida con los nombres/tipos de los nodos extremos (para la API GET).
export interface KgRelacionExpandida extends KgRelacion {
  origen_nombre: string
  origen_tipo: KgNodoTipo
  destino_nombre: string
  destino_tipo: KgNodoTipo
}

export interface RecomendacionIA {
  tipo_automatizacion: TipoAutomatizacion
  titulo: string
  herramientas: string[]
  justificacion: string
  actividades_automatizables: string[]
  score_impacto: number
  score_esfuerzo: number
  beneficio_esperado: string
  riesgos_implementacion: string[]
  referencias_tobe: string[]
}

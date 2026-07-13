// ─── Shared types for Discovery components ────────────────────────────────

export interface Proceso {
  id: string
  nombre: string
  descripcion: string | null
  nivel: number
  estado_oferta: 'propuesto' | 'aceptado' | 'rechazado'
  origen: string
  roles_involucrados: string[]
  riesgos_detectados: string[]
  metadata_ia: Record<string, unknown> | null
  documento_origen_id?: string | null
}

export interface ProcesoConHijos extends Proceso {
  hijos: Proceso[]
}

export interface DocumentoItem {
  id: string
  nombre_archivo: string
  tipo: string | null
  estado_procesamiento: string
  clasificacion: Record<string, unknown> | null
  created_at: string
}

export type DocAnalisis = {
  nombre_archivo: string
  resumen_ejecutivo: string | null
  analisis_ia: {
    resumen_ejecutivo?: string
    diagnostico_operacional?: string
    nivel_madurez_amo?: number
    nivel_madurez_nombre?: string
    nivel_madurez_evidencia?: string
    hallazgos_criticos?: string[]
    riesgos_criticos?: Array<{ riesgo: string; impacto: string; evidencia: string }>
    oportunidades_valor?: Array<{ oportunidad: string; impacto_estimado: string; complejidad_implementacion: string }>
    brechas_documentacion?: string[]
    quick_wins?: string[]
    proximos_pasos_sugeridos?: string[]
    roles_y_responsabilidades?: { brechas_de_rol?: string[] }
    recomendacion_ejecutiva?: string
  } | null
}

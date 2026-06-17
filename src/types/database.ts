export type RolTipo =
  | 'super_admin'
  | 'director_proyecto'
  | 'consultor'
  | 'sponsor_cliente'
  | 'usuario_cliente'

export type EstadoProcesamiento = 'pendiente' | 'procesando' | 'listo' | 'error'

export type EstadoProyecto = 'activo' | 'pausado' | 'cerrado'

export interface Cliente {
  id: string
  razon_social: string
  rut: string | null
  industria: string | null
  tamano: string | null
  facturacion: number | null
  dotacion: number | null
  objetivos_estrategicos: string | null
  riesgos_declarados: string | null
  madurez_digital: string | null
  inteligencia_industria: Record<string, unknown>
  activo: boolean
  created_at: string
  updated_at: string
}

export interface Proyecto {
  id: string
  cliente_id: string
  nombre: string
  alcance: string | null
  estado_general: EstadoProyecto
  fase_actual: number
  discovery_resumen: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface Usuario {
  id: string
  nombre: string
  email: string
  rol: RolTipo
  activo: boolean
  created_at: string
  updated_at: string
}

export interface UsuarioProyecto {
  usuario_id: string
  proyecto_id: string
  rol_override: RolTipo | null
}

export interface Documento {
  id: string
  proyecto_id: string
  nombre_archivo: string
  tipo: string | null
  url_storage: string
  estado_procesamiento: EstadoProcesamiento
  clasificacion: Record<string, unknown>
  resumen_ejecutivo: string | null
  subido_por: string | null
  created_at: string
  updated_at: string
}

export type OrigenProceso = 'detectado' | 'propuesta_ia' | 'manual'
export type EstadoOferta = 'propuesto' | 'aceptado' | 'rechazado'

export interface Proceso {
  id: string
  proyecto_id: string
  padre_id: string | null
  documento_origen_id: string | null
  nombre: string
  descripcion: string | null
  nivel: number
  tipo: 'macroproceso' | 'proceso' | 'subproceso' | 'actividad' | 'tarea'
  origen: OrigenProceso
  estado_oferta: EstadoOferta
  roles_involucrados: string[] | null
  riesgos_detectados: string[] | null
  metadata_ia: Record<string, unknown> | null
  orden: number
  created_at: string
  updated_at: string
}

export interface Job {
  id: string
  tipo: 'clasificar_documento' | 'resumir_documento' | 'discovery_procesos'
  estado: 'pendiente' | 'procesando' | 'listo' | 'error'
  payload: Record<string, unknown>
  resultado: Record<string, unknown> | null
  error_mensaje: string | null
  intentos: number
  documento_id: string | null
  proyecto_id: string | null
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: number
  usuario_id: string | null
  accion: string
  entidad: string
  entidad_id: string | null
  detalle: Record<string, unknown>
  ip: string | null
  created_at: string
}

// ── Fase 3: Artefactos ──────────────────────────────────────────────────────

export type TipoArtefacto =
  | 'sipoc'
  | 'as_is'
  | 'bpmn'
  | 'historias_usuario'
  | 'flujograma'
  | 'raci'
  | 'riesgo_control'
  | 'kpi_sla'
  | 'diagnostico'
  | 'to_be'
  | 'dashboard_brechas'
  | 'cierre_ejecutivo'

export type EstadoValidacion = 'pendiente' | 'validado' | 'publicado'

export interface Artefacto {
  id: string
  proceso_id: string
  proyecto_id: string
  tipo: TipoArtefacto
  contenido: Record<string, unknown>
  estado_validacion: EstadoValidacion
  version: number
  generado_por_ia: boolean
  created_at: string
  updated_at: string
}

// Tipos extendidos con joins frecuentes
export interface ClienteConProyectos extends Cliente {
  proyectos: Proyecto[]
}

export interface ProyectoConCliente extends Proyecto {
  cliente: Pick<Cliente, 'id' | 'razon_social' | 'industria'>
}

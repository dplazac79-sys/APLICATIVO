export type TipoSimulacion = 'operacional' | 'financiera' | 'organizacional'
export type Escenario = 'conservador' | 'base' | 'optimista' | 'custom'

export const ESCENARIO_MULTIPLICADOR: Record<Escenario, number> = {
  conservador: 0.50,
  base:        0.75,
  optimista:   1.00,
  custom:      0,   // se reemplaza con parametros.multiplicador_custom
}

// ── Parámetros por tipo de motor ──────────────────────────────────────────

export interface ParametrosOperacional {
  tiempo_ciclo_asis_horas: number        // duración actual del proceso (horas)
  throughput_asis_unidades_dia: number   // unidades procesadas por día actualmente
  carga_trabajo_asis_ftes: number        // FTEs dedicados al proceso actualmente
  mejora_tiempo_ciclo_pct: number        // % reducción esperada de tiempo (del TO-BE)
  mejora_throughput_pct: number          // % aumento esperado de throughput
  multiplicador_custom?: number          // 0-1, solo para escenario custom
}

export interface ParametrosFinanciera {
  // El ahorro se calcula como: horas_ahorradas_mes × valor_hora_clp
  // costo_operacional_mensual_clp es contexto para el ROI (inversión vs. costo base), no entra en el ahorro
  // para evitar doble conteo (si el costo operacional incluye salarios).
  costo_operacional_mensual_clp: number  // costo mensual base del proceso (contexto)
  costo_implementacion_clp: number       // inversión requerida para implementar el cambio
  valor_hora_clp: number                 // costo promedio por hora de FTE
  horas_ciclo_dia: number                // horas de proceso por día (base de cálculo)
  dias_laborales_mes: number             // default 22
  mejora_tiempo_ciclo_pct: number        // % mejora esperada (mismo que operacional)
  multiplicador_custom?: number
}

export interface ParametrosOrganizacional {
  headcount_actual: number               // personas en el proceso hoy
  roles_involucrados: string[]           // lista de roles del proceso (RACI)
  ftes_a_liberar_base: number            // FTEs liberados en escenario base (de operacional)
  roles_nuevos_estimados: string[]       // roles que el TO-BE requiere (vacíos hoy)
  multiplicador_custom?: number
}

// ── Resultados por escenario ──────────────────────────────────────────────

export interface ResultadoOperacional {
  escenario: Escenario
  tiempo_ciclo_tobe_horas: number
  throughput_tobe_unidades_dia: number
  carga_trabajo_tobe_ftes: number
  ahorro_horas_dia: number
  ftes_liberados: number
  mejora_aplicada_pct: number
}

export interface ResultadoFinanciera {
  escenario: Escenario
  ahorro_mensual_clp: number
  ahorro_anual_clp: number
  roi_pct: number
  payback_meses: number
  costo_implementacion_clp: number
  mejora_aplicada_pct: number
}

export interface ResultadoOrganizacional {
  escenario: Escenario
  ftes_optimizados: number
  reduccion_dotacion_pct: number
  roles_a_reasignar: string[]
  roles_a_crear: string[]
  headcount_tobe: number
}

export type ResultadoSimulacion =
  | ResultadoOperacional
  | ResultadoFinanciera
  | ResultadoOrganizacional

export type ResultadosTodos<T extends ResultadoSimulacion> = Record<Escenario, T>

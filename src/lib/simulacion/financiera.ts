import type {
  Escenario,
  ParametrosFinanciera,
  ResultadoFinanciera,
  ResultadosTodos,
} from './tipos'
import { ESCENARIO_MULTIPLICADOR } from './tipos'

function calcularEscenario(
  p: ParametrosFinanciera,
  escenario: Escenario,
): ResultadoFinanciera {
  const mult =
    escenario === 'custom'
      ? (p.multiplicador_custom ?? 0.75)
      : ESCENARIO_MULTIPLICADOR[escenario]

  const dias = p.dias_laborales_mes ?? 22
  const mejora_tiempo_pct = p.mejora_tiempo_ciclo_pct * mult

  // Ahorro por reducción de carga de trabajo (horas × valor hora)
  // Es la fuente principal para evitar doble conteo con el costo operacional total.
  // El costo_operacional_mensual_clp se usa solo para calcular el ROI sobre la inversión.
  const horas_ahorradas_dia = p.horas_ciclo_dia * (mejora_tiempo_pct / 100)
  const horas_ahorradas_mes = horas_ahorradas_dia * dias
  const ahorro_mensual = horas_ahorradas_mes * p.valor_hora_clp
  const ahorro_anual = ahorro_mensual * 12

  const roi_pct =
    p.costo_implementacion_clp > 0
      ? ((ahorro_anual - p.costo_implementacion_clp) / p.costo_implementacion_clp) * 100
      : 0

  const payback_meses =
    ahorro_mensual > 0 ? p.costo_implementacion_clp / ahorro_mensual : 999

  return {
    escenario,
    ahorro_mensual_clp: round0(ahorro_mensual),
    ahorro_anual_clp: round0(ahorro_anual),
    roi_pct: round2(roi_pct),
    payback_meses: round2(payback_meses),
    costo_implementacion_clp: p.costo_implementacion_clp,
    mejora_aplicada_pct: round2(mejora_tiempo_pct),
  }
}

export function simularFinanciera(
  p: ParametrosFinanciera,
): ResultadosTodos<ResultadoFinanciera> {
  return {
    conservador: calcularEscenario(p, 'conservador'),
    base:        calcularEscenario(p, 'base'),
    optimista:   calcularEscenario(p, 'optimista'),
    custom:      calcularEscenario(p, 'custom'),
  }
}

function round0(n: number) {
  return Math.round(n)
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

import type {
  Escenario,
  ParametrosOperacional,
  ResultadoOperacional,
  ResultadosTodos,
} from './tipos'
import { ESCENARIO_MULTIPLICADOR } from './tipos'

function calcularEscenario(
  p: ParametrosOperacional,
  escenario: Escenario,
): ResultadoOperacional {
  const mult =
    escenario === 'custom'
      ? (p.multiplicador_custom ?? 0.75)
      : ESCENARIO_MULTIPLICADOR[escenario]

  const mejora_tiempo_pct = p.mejora_tiempo_ciclo_pct * mult
  const mejora_throughput_pct = p.mejora_throughput_pct * mult

  const tiempo_ciclo_tobe = p.tiempo_ciclo_asis_horas * (1 - mejora_tiempo_pct / 100)
  const throughput_tobe = p.throughput_asis_unidades_dia * (1 + mejora_throughput_pct / 100)

  // FTEs proporcional a la reducción de tiempo de ciclo
  const carga_trabajo_tobe = p.carga_trabajo_asis_ftes * (1 - mejora_tiempo_pct / 100)
  const ftes_liberados = Math.max(0, p.carga_trabajo_asis_ftes - carga_trabajo_tobe)
  const ahorro_horas_dia =
    (p.tiempo_ciclo_asis_horas - tiempo_ciclo_tobe) *
    (p.throughput_asis_unidades_dia / p.tiempo_ciclo_asis_horas)

  return {
    escenario,
    tiempo_ciclo_tobe_horas: round2(tiempo_ciclo_tobe),
    throughput_tobe_unidades_dia: round2(throughput_tobe),
    carga_trabajo_tobe_ftes: round2(carga_trabajo_tobe),
    ahorro_horas_dia: round2(ahorro_horas_dia),
    ftes_liberados: round2(ftes_liberados),
    mejora_aplicada_pct: round2(mejora_tiempo_pct),
  }
}

export function simularOperacional(
  p: ParametrosOperacional,
): ResultadosTodos<ResultadoOperacional> {
  return {
    conservador: calcularEscenario(p, 'conservador'),
    base:        calcularEscenario(p, 'base'),
    optimista:   calcularEscenario(p, 'optimista'),
    custom:      calcularEscenario(p, 'custom'),
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

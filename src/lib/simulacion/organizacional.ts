import type {
  Escenario,
  ParametrosOrganizacional,
  ResultadoOrganizacional,
  ResultadosTodos,
} from './tipos'
import { ESCENARIO_MULTIPLICADOR } from './tipos'

function calcularEscenario(
  p: ParametrosOrganizacional,
  escenario: Escenario,
): ResultadoOrganizacional {
  const mult =
    escenario === 'custom'
      ? (p.multiplicador_custom ?? 0.75)
      : ESCENARIO_MULTIPLICADOR[escenario]

  const ftes_liberados = Math.min(
    p.ftes_a_liberar_base * mult,
    p.headcount_actual,
  )
  const headcount_tobe = Math.max(0, p.headcount_actual - ftes_liberados)
  const reduccion_pct = (ftes_liberados / p.headcount_actual) * 100

  // Roles a reasignar: proporción de roles existentes según FTEs liberados
  const n_reasignar = Math.round(
    (p.roles_involucrados.length * (reduccion_pct / 100)) * mult,
  )
  const roles_a_reasignar = p.roles_involucrados.slice(0, n_reasignar)

  // Roles nuevos: se crean proporcionalmente al escenario
  const n_nuevos = Math.round(p.roles_nuevos_estimados.length * mult)
  const roles_a_crear = p.roles_nuevos_estimados.slice(0, n_nuevos)

  return {
    escenario,
    ftes_optimizados: round2(ftes_liberados),
    reduccion_dotacion_pct: round2(reduccion_pct),
    roles_a_reasignar,
    roles_a_crear,
    headcount_tobe: round2(headcount_tobe),
  }
}

export function simularOrganizacional(
  p: ParametrosOrganizacional,
): ResultadosTodos<ResultadoOrganizacional> {
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

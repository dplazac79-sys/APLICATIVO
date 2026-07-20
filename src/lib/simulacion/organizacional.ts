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

  // Roles a reasignar: proporción de roles existentes según FTEs liberados.
  // El CONTEO (n_reasignar) sí es correcto — se deriva de reduccion_pct — pero
  // CUÁLES roles específicos se listan es arbitrario: slice(0, n) toma los
  // primeros n en el orden en que vinieron en el array de entrada, no según
  // ninguna señal real de qué rol es más prescindible o redundante (no existe
  // ese dato en el modelo hoy). Hallazgo de auditoría de correctitud de
  // negocio — dejar documentado en vez de simular una priorización que no
  // se puede sustentar con los datos disponibles; si se agrega una señal
  // real (ej. redundancia de funciones, antigüedad, carga actual) debería
  // ordenarse por esa señal en vez de tomar los primeros n.
  const n_reasignar = Math.round(
    (p.roles_involucrados.length * (reduccion_pct / 100)) * mult,
  )
  const roles_a_reasignar = p.roles_involucrados.slice(0, n_reasignar)

  // Roles nuevos: se crean proporcionalmente al escenario — mismo caveat
  // que roles_a_reasignar sobre CUÁLES roles nuevos se listan primero.
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

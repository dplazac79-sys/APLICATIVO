import { describe, it, expect } from 'vitest'
import { simularOperacional } from '../../src/lib/simulacion/operacional'
import { simularFinanciera } from '../../src/lib/simulacion/financiera'
import { simularOrganizacional } from '../../src/lib/simulacion/organizacional'
import type {
  ParametrosOperacional,
  ParametrosFinanciera,
  ParametrosOrganizacional,
  Escenario,
} from '../../src/lib/simulacion/tipos'

const ESCENARIOS: Escenario[] = ['conservador', 'base', 'optimista', 'custom']

// ── Fixtures deterministas ────────────────────────────────────────────────

const paramOp: ParametrosOperacional = {
  tiempo_ciclo_asis_horas: 8,
  throughput_asis_unidades_dia: 10,
  carga_trabajo_asis_ftes: 4,
  mejora_tiempo_ciclo_pct: 40,
  mejora_throughput_pct: 30,
  multiplicador_custom: 0.6,
}

const paramFin: ParametrosFinanciera = {
  costo_operacional_mensual_clp: 5_000_000,
  costo_implementacion_clp: 20_000_000,
  valor_hora_clp: 15_000,
  horas_ciclo_dia: 6,
  dias_laborales_mes: 22,
  mejora_tiempo_ciclo_pct: 40,
  multiplicador_custom: 0.6,
}

const paramOrg: ParametrosOrganizacional = {
  headcount_actual: 10,
  roles_involucrados: ['Operador', 'Supervisor', 'Analista', 'Jefe'],
  ftes_a_liberar_base: 2,
  roles_nuevos_estimados: ['Automatizador RPA', 'Analista de datos'],
  multiplicador_custom: 0.6,
}

// ── Motor Operacional ─────────────────────────────────────────────────────

describe('simularOperacional', () => {
  const r = simularOperacional(paramOp)

  it('produce los 4 escenarios', () => {
    expect(Object.keys(r)).toEqual(['conservador', 'base', 'optimista', 'custom'])
  })

  it('optimista >= base >= conservador en ftes_liberados', () => {
    expect(r.optimista.ftes_liberados).toBeGreaterThanOrEqual(r.base.ftes_liberados)
    expect(r.base.ftes_liberados).toBeGreaterThanOrEqual(r.conservador.ftes_liberados)
  })

  it('tiempo_ciclo_tobe optimista <= base <= conservador (menor = mejor)', () => {
    expect(r.optimista.tiempo_ciclo_tobe_horas).toBeLessThanOrEqual(r.base.tiempo_ciclo_tobe_horas)
    expect(r.base.tiempo_ciclo_tobe_horas).toBeLessThanOrEqual(r.conservador.tiempo_ciclo_tobe_horas)
  })

  it('throughput_tobe optimista >= base >= conservador', () => {
    expect(r.optimista.throughput_tobe_unidades_dia).toBeGreaterThanOrEqual(r.base.throughput_tobe_unidades_dia)
    expect(r.base.throughput_tobe_unidades_dia).toBeGreaterThanOrEqual(r.conservador.throughput_tobe_unidades_dia)
  })

  it('tiempo_ciclo_tobe < AS-IS en todos los escenarios', () => {
    for (const e of Object.values(r)) {
      expect(e.tiempo_ciclo_tobe_horas).toBeLessThan(paramOp.tiempo_ciclo_asis_horas)
    }
  })

  it('optimista aplica 100% de mejora esperada', () => {
    expect(r.optimista.mejora_aplicada_pct).toBeCloseTo(paramOp.mejora_tiempo_ciclo_pct, 1)
  })

  it('conservador aplica 50% de mejora esperada', () => {
    expect(r.conservador.mejora_aplicada_pct).toBeCloseTo(paramOp.mejora_tiempo_ciclo_pct * 0.5, 1)
  })

  it('resultados son deterministas (misma entrada = mismo output)', () => {
    const r2 = simularOperacional(paramOp)
    expect(r2.base.ftes_liberados).toBe(r.base.ftes_liberados)
    expect(r2.optimista.tiempo_ciclo_tobe_horas).toBe(r.optimista.tiempo_ciclo_tobe_horas)
  })
})

// ── Motor Financiero ──────────────────────────────────────────────────────

describe('simularFinanciera', () => {
  const r = simularFinanciera(paramFin)

  it('produce los 4 escenarios', () => {
    expect(Object.keys(r)).toEqual(['conservador', 'base', 'optimista', 'custom'])
  })

  it('optimista >= base >= conservador en ahorro_anual', () => {
    expect(r.optimista.ahorro_anual_clp).toBeGreaterThanOrEqual(r.base.ahorro_anual_clp)
    expect(r.base.ahorro_anual_clp).toBeGreaterThanOrEqual(r.conservador.ahorro_anual_clp)
  })

  it('roi_pct optimista >= base >= conservador', () => {
    expect(r.optimista.roi_pct).toBeGreaterThanOrEqual(r.base.roi_pct)
    expect(r.base.roi_pct).toBeGreaterThanOrEqual(r.conservador.roi_pct)
  })

  it('payback_meses optimista <= base <= conservador (menor = mejor)', () => {
    expect(r.optimista.payback_meses).toBeLessThanOrEqual(r.base.payback_meses)
    expect(r.base.payback_meses).toBeLessThanOrEqual(r.conservador.payback_meses)
  })

  it('ahorro_anual = ahorro_mensual * 12', () => {
    for (const e of Object.values(r)) {
      expect(e.ahorro_anual_clp).toBeCloseTo(e.ahorro_mensual_clp * 12, -2)
    }
  })

  it('costo_implementacion es constante entre escenarios', () => {
    const costos = Object.values(r).map(e => e.costo_implementacion_clp)
    expect(new Set(costos).size).toBe(1)
  })

  it('resultados son deterministas', () => {
    const r2 = simularFinanciera(paramFin)
    expect(r2.base.roi_pct).toBe(r.base.roi_pct)
  })
})

// ── Motor Organizacional ──────────────────────────────────────────────────

describe('simularOrganizacional', () => {
  const r = simularOrganizacional(paramOrg)

  it('produce los 4 escenarios', () => {
    expect(Object.keys(r)).toEqual(['conservador', 'base', 'optimista', 'custom'])
  })

  it('optimista >= base >= conservador en ftes_optimizados', () => {
    expect(r.optimista.ftes_optimizados).toBeGreaterThanOrEqual(r.base.ftes_optimizados)
    expect(r.base.ftes_optimizados).toBeGreaterThanOrEqual(r.conservador.ftes_optimizados)
  })

  it('reduccion_dotacion_pct optimista >= base >= conservador', () => {
    expect(r.optimista.reduccion_dotacion_pct).toBeGreaterThanOrEqual(r.base.reduccion_dotacion_pct)
    expect(r.base.reduccion_dotacion_pct).toBeGreaterThanOrEqual(r.conservador.reduccion_dotacion_pct)
  })

  it('headcount_tobe = headcount_actual - ftes_optimizados', () => {
    for (const e of Object.values(r)) {
      expect(e.headcount_tobe).toBeCloseTo(paramOrg.headcount_actual - e.ftes_optimizados, 1)
    }
  })

  it('headcount_tobe nunca es negativo', () => {
    for (const e of Object.values(r)) {
      expect(e.headcount_tobe).toBeGreaterThanOrEqual(0)
    }
  })

  it('optimista tiene más roles_a_crear que conservador', () => {
    expect(r.optimista.roles_a_crear.length).toBeGreaterThanOrEqual(r.conservador.roles_a_crear.length)
  })

  it('resultados son deterministas', () => {
    const r2 = simularOrganizacional(paramOrg)
    expect(r2.base.ftes_optimizados).toBe(r.base.ftes_optimizados)
  })
})

// ── Edge cases ────────────────────────────────────────────────────────────

describe('edge cases — valores extremos', () => {
  it('operacional: mejora 0% → TO-BE = AS-IS', () => {
    const p: ParametrosOperacional = { ...paramOp, mejora_tiempo_ciclo_pct: 0, mejora_throughput_pct: 0 }
    const r = simularOperacional(p)
    for (const e of ESCENARIOS) {
      expect(r[e].tiempo_ciclo_tobe_horas).toBe(p.tiempo_ciclo_asis_horas)
      expect(r[e].ftes_liberados).toBe(0)
    }
  })

  it('operacional: mejora 100% → optimista ciclo = 0h', () => {
    const p: ParametrosOperacional = { ...paramOp, mejora_tiempo_ciclo_pct: 100 }
    const r = simularOperacional(p)
    expect(r.optimista.tiempo_ciclo_tobe_horas).toBe(0)
  })

  it('operacional: ftes_liberados nunca es negativo', () => {
    const p: ParametrosOperacional = { ...paramOp, carga_trabajo_asis_ftes: 0 }
    const r = simularOperacional(p)
    for (const e of ESCENARIOS) {
      expect(r[e].ftes_liberados).toBeGreaterThanOrEqual(0)
    }
  })

  it('financiera: sin implementación → payback = 999 (sin costo)', () => {
    const p: ParametrosFinanciera = { ...paramFin, costo_implementacion_clp: 0 }
    const r = simularFinanciera(p)
    // roi_pct = 0 cuando costo_implementacion = 0 (protección división por cero)
    for (const e of ESCENARIOS) {
      expect(r[e].roi_pct).toBe(0)
    }
  })

  it('financiera: mejora 0% → ahorro = 0 en todos los escenarios', () => {
    const p: ParametrosFinanciera = { ...paramFin, mejora_tiempo_ciclo_pct: 0 }
    const r = simularFinanciera(p)
    for (const e of ESCENARIOS) {
      expect(r[e].ahorro_mensual_clp).toBe(0)
      expect(r[e].ahorro_anual_clp).toBe(0)
    }
  })

  it('financiera: ahorro no es negativo con parámetros válidos', () => {
    const r = simularFinanciera(paramFin)
    for (const e of ESCENARIOS) {
      expect(r[e].ahorro_mensual_clp).toBeGreaterThanOrEqual(0)
    }
  })

  it('organizacional: ftes_a_liberar > headcount → headcount_tobe = 0', () => {
    const p: ParametrosOrganizacional = { ...paramOrg, headcount_actual: 2, ftes_a_liberar_base: 10 }
    const r = simularOrganizacional(p)
    for (const e of ESCENARIOS) {
      expect(r[e].headcount_tobe).toBeGreaterThanOrEqual(0)
    }
  })

  it('organizacional: sin roles nuevos → roles_a_crear vacío en todos', () => {
    const p: ParametrosOrganizacional = { ...paramOrg, roles_nuevos_estimados: [] }
    const r = simularOrganizacional(p)
    for (const e of ESCENARIOS) {
      expect(r[e].roles_a_crear).toHaveLength(0)
    }
  })

  it('custom con multiplicador_custom = 0 → sin mejora', () => {
    const pOp: ParametrosOperacional = { ...paramOp, multiplicador_custom: 0 }
    const r = simularOperacional(pOp)
    expect(r.custom.tiempo_ciclo_tobe_horas).toBe(pOp.tiempo_ciclo_asis_horas)
    expect(r.custom.ftes_liberados).toBe(0)
  })

  it('custom con multiplicador_custom = 1 → igual que optimista', () => {
    const pOp: ParametrosOperacional = { ...paramOp, multiplicador_custom: 1 }
    const r = simularOperacional(pOp)
    expect(r.custom.tiempo_ciclo_tobe_horas).toBe(r.optimista.tiempo_ciclo_tobe_horas)
    expect(r.custom.ftes_liberados).toBe(r.optimista.ftes_liberados)
  })
})

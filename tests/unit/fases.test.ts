import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeQuery, fakeAdmin } from '../helpers/supabase-mock'
import { getFasesProyecto } from '../../src/lib/fases'

const mockCreateAdminClient = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => mockCreateAdminClient() }))

/**
 * getFasesProyecto dispara ~9 queries en paralelo (proyecto, docsTotal,
 * procesos, aceptados vía domain/procesos, glosarioRoles, entregables,
 * reuniones, simulaciones, recomendaciones) + una condicional de artefactos.
 * Este helper arma un admin fake que responde según la tabla consultada,
 * con valores por defecto "proyecto recién creado, todo en cero" que cada
 * test sobreescribe según lo que quiere probar.
 */
function armarAdmin(overrides: Partial<Record<string, unknown>> = {}) {
  const defaults: Record<string, unknown> = {
    proyecto: { data: { id: 'proy-1', nombre: 'P', discovery_resumen: null } },
    documento: { count: 0 },
    proceso: { count: 0, data: [] }, // .select() sin count usado por getProcesosAceptadosIds
    glosario_roles_analisis: { count: 0 },
    entregable: { count: 0 },
    reunion: { count: 0 },
    simulacion: { count: 0 },
    kg_recomendacion: { count: 0 },
    artefacto: { count: 0 },
  }
  const merged = { ...defaults, ...overrides }
  return fakeAdmin((table: string) => fakeQuery(merged[table] ?? { count: 0, data: [] }))
}

describe('getFasesProyecto', () => {
  beforeEach(() => vi.clearAllMocks())

  it('proyecto inexistente: F1 activa (no completada) y resto bloqueadas', async () => {
    mockCreateAdminClient.mockReturnValue(armarAdmin({ proyecto: { data: null } }))
    const { fases } = await getFasesProyecto('proy-x')
    expect(fases[0].status).toBe('activa')
    expect(fases.slice(1).every(f => f.status === 'bloqueada')).toBe(true)
  })

  it('proyecto recién creado sin datos: solo F1 completada, F2 activa, resto bloqueadas', async () => {
    mockCreateAdminClient.mockReturnValue(armarAdmin())
    const { fases } = await getFasesProyecto('proy-1')
    expect(fases[0].status).toBe('completada') // F1 Dashboard
    expect(fases[1].status).toBe('activa')     // F2 Centro Documental
    expect(fases.slice(2).every(f => f.status === 'bloqueada')).toBe(true)
  })

  it('con documentos cargados, F2 completa y F3 se desbloquea', async () => {
    mockCreateAdminClient.mockReturnValue(armarAdmin({ documento: { count: 3 } }))
    const { fases } = await getFasesProyecto('proy-1')
    expect(fases[1].status).toBe('completada') // F2
    expect(fases[2].status).toBe('activa')     // F3 Process Discovery
  })

  it('F3 requiere procesos aceptados Y glosario de roles completado (ambos, no solo uno)', async () => {
    mockCreateAdminClient.mockReturnValue(
      armarAdmin({
        documento: { count: 3 },
        proceso: { count: 2, data: [{ id: 'p1' }, { id: 'p2' }] }, // procesos aceptados = 2
        glosario_roles_analisis: { count: 0 }, // pero glosario NO completado
      })
    )
    const { fases } = await getFasesProyecto('proy-1')
    expect(fases[2].status).toBe('activa') // F3 sigue activa, no completada
  })

  it('F4 (Artefactos) requiere al menos 8 artefactos de procesos aceptados', async () => {
    mockCreateAdminClient.mockReturnValue(
      armarAdmin({
        documento: { count: 3 },
        proceso: { count: 2, data: [{ id: 'p1' }, { id: 'p2' }] },
        glosario_roles_analisis: { count: 1 },
        artefacto: { count: 7 }, // uno menos del umbral
      })
    )
    const { fases } = await getFasesProyecto('proy-1')
    expect(fases[2].status).toBe('completada') // F3 completa
    expect(fases[3].status).toBe('activa')     // F4 activa pero no completa (7 < 8)
  })

  it('proyecto con todas las fases completas: F7 también completada', async () => {
    mockCreateAdminClient.mockReturnValue(
      armarAdmin({
        documento: { count: 5 },
        proceso: { count: 2, data: [{ id: 'p1' }, { id: 'p2' }] },
        glosario_roles_analisis: { count: 1 },
        artefacto: { count: 16 },
        entregable: { count: 1 },
        simulacion: { count: 1 },
        kg_recomendacion: { count: 1 },
      })
    )
    const { fases } = await getFasesProyecto('proy-1')
    expect(fases.every(f => f.status === 'completada')).toBe(true)
  })

  it('siempre devuelve exactamente 7 fases en orden F1..F7', async () => {
    mockCreateAdminClient.mockReturnValue(armarAdmin())
    const { fases } = await getFasesProyecto('proy-1')
    expect(fases.map(f => f.id)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
})

describe('getFasesProyecto — rol cliente (sponsor_cliente/usuario_cliente)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('devuelve solo 5 fases de trabajo (sin Dashboard ni PCC/Simulador/Automation)', async () => {
    mockCreateAdminClient.mockReturnValue(armarAdmin())
    const { fases } = await getFasesProyecto('proy-1', 'sponsor_cliente')
    expect(fases).toHaveLength(5)
    expect(fases.map(f => f.href)).toEqual([
      '/documentos', '/discovery', '/artefactos', '/horizonte', '/versiones',
    ])
  })

  it('proyecto recién creado: F1 Documentos activa, F2..F5 bloqueadas', async () => {
    mockCreateAdminClient.mockReturnValue(armarAdmin())
    const { fases } = await getFasesProyecto('proy-1', 'sponsor_cliente')
    expect(fases[0].status).toBe('activa')      // F1 Documentos
    expect(fases.slice(1).every(f => f.status === 'bloqueada')).toBe(true) // F2..F5
  })

  it('Horizonte (F4) queda "activa" hasta que exista una simulación guardada', async () => {
    mockCreateAdminClient.mockReturnValue(
      armarAdmin({
        documento: { count: 5 },
        proceso: { count: 2, data: [{ id: 'p1' }, { id: 'p2' }] },
        glosario_roles_analisis: { count: 1 },
        artefacto: { count: 16 },
      })
    )
    const { fases } = await getFasesProyecto('proy-1', 'sponsor_cliente')
    const horizonte = fases.find(f => f.nombre === 'Horizonte de Impacto')
    expect(horizonte?.status).toBe('activa')
  })

  it('Horizonte (F4) queda "completada" una vez que hay al menos una simulación guardada', async () => {
    mockCreateAdminClient.mockReturnValue(
      armarAdmin({
        documento: { count: 5 },
        proceso: { count: 2, data: [{ id: 'p1' }, { id: 'p2' }] },
        glosario_roles_analisis: { count: 1 },
        artefacto: { count: 16 },
        simulacion: { count: 1 },
      })
    )
    const { fases } = await getFasesProyecto('proy-1', 'sponsor_cliente')
    const horizonte = fases.find(f => f.nombre === 'Horizonte de Impacto')
    expect(horizonte?.status).toBe('completada')
  })

  it('mismo rol interno (consultor) sigue viendo las 7 fases originales, sin cambios', async () => {
    mockCreateAdminClient.mockReturnValue(armarAdmin())
    const { fases } = await getFasesProyecto('proy-1', 'consultor')
    expect(fases).toHaveLength(7)
    expect(fases[0].nombre).toBe('Dashboard')
  })
})

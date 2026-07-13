import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeQuery, fakeAdmin } from '../helpers/supabase-mock'
import { ejecutarCierreProyecto } from '../../src/lib/automation/job-cierre'

const mockCreateAdminClient = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => mockCreateAdminClient() }))

/**
 * ejecutarCierreProyecto consulta ~7 tablas y luego escribe un grafo de nodos
 * (kg_nodo/kg_relacion) con un patrón upsert-manual (select existente ->
 * insert o update). Este fixture cubre el camino feliz con datos mínimos —
 * no reproduce la lógica interna de merge/frecuencia del grafo (no exportada),
 * pero sí verifica el resultado observable: transición de estado del job y
 * el payload final del snapshot de industria.
 */
function armarAdmin(overrides: Record<string, unknown> = {}) {
  const calls: { table: string; args: unknown[] }[] = []
  const jobUpdates: unknown[] = []
  const snapshotUpserts: unknown[] = []

  const defaults: Record<string, unknown> = {
    proyecto: { data: { id: 'proy-1', nombre: 'P', cliente_id: 'c1', cliente: { industria: 'Banca' } } },
    proceso: { data: [{ id: 'p1', nombre: 'Aprobación de crédito', tipo: 'core' }] },
    riesgo: { data: [{ nombre: 'Fraude', tipo: 'operacional' }] },
    kpi: { data: [{ nombre: 'Tiempo de ciclo' }] },
    kg_recomendacion: { data: [{ tipo_automatizacion: 'RPA', herramientas: ['UiPath'], score_impacto: 4, proceso_id: 'p1' }] },
    kg_industria_snapshot: { data: null },
    kg_nodo: { data: null }, // siempre "no existe" -> siempre inserta
    kg_relacion: { data: null },
  }
  const merged = { ...defaults, ...overrides }

  const admin = fakeAdmin((table: string) => {
    const q = fakeQuery(merged[table] ?? { data: null })
    if (table === 'kg_job_cierre') {
      const originalUpdate = q.update as (payload: unknown) => unknown
      q.update = vi.fn((payload: unknown) => { jobUpdates.push(payload); return originalUpdate(payload) })
    }
    if (table === 'kg_industria_snapshot') {
      const originalUpsert = q.upsert as (payload: unknown) => unknown
      q.upsert = vi.fn((payload: unknown) => { snapshotUpserts.push(payload); return originalUpsert(payload) })
    }
    if (table === 'kg_nodo') {
      // insert().select().single() debe devolver un id de nodo válido
      q.single = vi.fn(() => Promise.resolve({ data: { id: `nodo-${calls.length}` } }))
    }
    calls.push({ table, args: [] })
    return q
  })

  return { admin, jobUpdates, snapshotUpserts, calls }
}

describe('ejecutarCierreProyecto', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marca el job como completado con el resumen de patrones extraídos', async () => {
    const { admin, jobUpdates } = armarAdmin()
    mockCreateAdminClient.mockReturnValue(admin)

    await ejecutarCierreProyecto('proy-1', 'job-1')

    expect(jobUpdates[0]).toMatchObject({ estado: 'procesando' })
    const finalUpdate = jobUpdates[jobUpdates.length - 1] as { estado: string; resultado: Record<string, number> }
    expect(finalUpdate.estado).toBe('completado')
    expect(finalUpdate.resultado).toMatchObject({
      industria: 'Banca',
      procesos_extraidos: 1,
      riesgos_extraidos: 1,
      kpis_extraidos: 1,
      automatizaciones_extraidas: 1,
    })
  })

  it('usa "Sin clasificar" cuando el proyecto no tiene industria asociada', async () => {
    const { admin, snapshotUpserts } = armarAdmin({
      proyecto: { data: { id: 'proy-1', nombre: 'P', cliente_id: null, cliente: null } },
    })
    mockCreateAdminClient.mockReturnValue(admin)

    await ejecutarCierreProyecto('proy-1', 'job-1')

    expect((snapshotUpserts[0] as { industria: string }).industria).toBe('Sin clasificar')
  })

  it('marca el job como error y relanza la excepción si una consulta falla', async () => {
    const { admin, jobUpdates } = armarAdmin()
    // Sobrescribe 'proyecto' para que lance
    const originalFrom = admin.from
    admin.from = vi.fn((table: string) => {
      if (table === 'proyecto') throw new Error('conexión perdida')
      return originalFrom(table)
    })
    mockCreateAdminClient.mockReturnValue(admin)

    await expect(ejecutarCierreProyecto('proy-1', 'job-1')).rejects.toThrow('conexión perdida')

    const finalUpdate = jobUpdates[jobUpdates.length - 1] as { estado: string; error_msg: string }
    expect(finalUpdate.estado).toBe('error')
    expect(finalUpdate.error_msg).toBe('conexión perdida')
  })

  it('incrementa proyectos_cerrados a partir del snapshot existente', async () => {
    const { admin, snapshotUpserts } = armarAdmin({
      kg_industria_snapshot: {
        data: {
          industria: 'Banca',
          proyectos_cerrados: 4,
          procesos_frecuentes: [],
          riesgos_frecuentes: [],
          kpis_frecuentes: [],
          automatizaciones: [],
        },
      },
    })
    mockCreateAdminClient.mockReturnValue(admin)

    await ejecutarCierreProyecto('proy-1', 'job-1')

    expect((snapshotUpserts[0] as { proyectos_cerrados: number }).proyectos_cerrados).toBe(5)
  })

  it('con listas vacías (proyecto sin procesos/riesgos/kpis) no lanza y reporta ceros', async () => {
    const { admin, jobUpdates } = armarAdmin({
      proceso: { data: [] },
      riesgo: { data: [] },
      kpi: { data: [] },
      kg_recomendacion: { data: [] },
    })
    mockCreateAdminClient.mockReturnValue(admin)

    await ejecutarCierreProyecto('proy-1', 'job-1')

    const finalUpdate = jobUpdates[jobUpdates.length - 1] as { estado: string; resultado: Record<string, number> }
    expect(finalUpdate.estado).toBe('completado')
    expect(finalUpdate.resultado).toMatchObject({
      procesos_extraidos: 0, riesgos_extraidos: 0, kpis_extraidos: 0, automatizaciones_extraidas: 0,
    })
  })
})

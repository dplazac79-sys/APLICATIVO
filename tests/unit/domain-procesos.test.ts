import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeQuery, fakeAdmin } from '../helpers/supabase-mock'
import { getProcesosAceptadosIds, contarArtefactosDeProcesosAceptados } from '../../src/lib/domain/procesos'

const mockCreateAdminClient = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockCreateAdminClient(),
}))

describe('getProcesosAceptadosIds', () => {
  beforeEach(() => vi.clearAllMocks())

  it('devuelve solo ids de procesos con estado_oferta = aceptado', async () => {
    mockCreateAdminClient.mockReturnValue(
      fakeAdmin(() => fakeQuery({ data: [{ id: 'p1' }, { id: 'p2' }] }))
    )
    const res = await getProcesosAceptadosIds('proy-1')
    expect(res.ids).toEqual(['p1', 'p2'])
    expect(res.total).toBe(2)
  })

  it('devuelve total 0 y lista vacía cuando no hay procesos aceptados', async () => {
    mockCreateAdminClient.mockReturnValue(fakeAdmin(() => fakeQuery({ data: [] })))
    const res = await getProcesosAceptadosIds('proy-1')
    expect(res.ids).toEqual([])
    expect(res.total).toBe(0)
  })

  it('trata data null (error de red) como lista vacía en vez de lanzar', async () => {
    mockCreateAdminClient.mockReturnValue(fakeAdmin(() => fakeQuery({ data: null })))
    const res = await getProcesosAceptadosIds('proy-1')
    expect(res.ids).toEqual([])
    expect(res.total).toBe(0)
  })
})

describe('contarArtefactosDeProcesosAceptados', () => {
  beforeEach(() => vi.clearAllMocks())

  it('cuenta artefactos solo de procesos aceptados (no de todos los procesos del proyecto)', async () => {
    mockCreateAdminClient.mockReturnValue(
      fakeAdmin(table => {
        if (table === 'proceso') return fakeQuery({ data: [{ id: 'p1' }, { id: 'p2' }] })
        if (table === 'artefacto') return fakeQuery({ count: 12 })
        throw new Error(`tabla inesperada: ${table}`)
      })
    )
    const total = await contarArtefactosDeProcesosAceptados('proy-1')
    expect(total).toBe(12)
  })

  it('no consulta artefactos si no hay procesos aceptados (evita un .in() vacío)', async () => {
    const artefactoQuery = vi.fn()
    mockCreateAdminClient.mockReturnValue(
      fakeAdmin(table => {
        if (table === 'proceso') return fakeQuery({ data: [] })
        artefactoQuery(table)
        return fakeQuery({ count: 999 })
      })
    )
    const total = await contarArtefactosDeProcesosAceptados('proy-1')
    expect(total).toBe(0)
    expect(artefactoQuery).not.toHaveBeenCalled()
  })

  it('devuelve 0 cuando count viene null', async () => {
    mockCreateAdminClient.mockReturnValue(
      fakeAdmin(table => {
        if (table === 'proceso') return fakeQuery({ data: [{ id: 'p1' }] })
        return fakeQuery({ count: null })
      })
    )
    const total = await contarArtefactosDeProcesosAceptados('proy-1')
    expect(total).toBe(0)
  })
})

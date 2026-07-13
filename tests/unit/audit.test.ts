import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeQuery, fakeAdmin } from '../helpers/supabase-mock'
import { registrarAudit } from '../../src/lib/audit'

const mockCreateAdminClient = vi.fn()
const mockCreateClient = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => mockCreateAdminClient() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: () => mockCreateClient() }))

describe('registrarAudit', () => {
  beforeEach(() => vi.clearAllMocks())

  it('usa usuarioId explícito sin llamar a supabase.auth.getUser() (caso jobs en segundo plano)', async () => {
    const insert = vi.fn(() => fakeQuery({}))
    mockCreateAdminClient.mockReturnValue({ from: vi.fn(() => ({ insert })) })

    await registrarAudit({ accion: 'CREATE', entidad: 'proceso', entidad_id: 'p1', usuarioId: 'u-job' })

    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ usuario_id: 'u-job', accion: 'CREATE', entidad: 'proceso', entidad_id: 'p1' })
    )
  })

  it('resuelve usuarioId vía supabase.auth.getUser() cuando no se pasa explícito', async () => {
    mockCreateClient.mockReturnValue({
      auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'u-sesion' } } })) },
    })
    const insert = vi.fn(() => fakeQuery({}))
    mockCreateAdminClient.mockReturnValue({ from: vi.fn(() => ({ insert })) })

    await registrarAudit({ accion: 'LOGIN', entidad: 'usuario' })

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ usuario_id: 'u-sesion' }))
  })

  it('usa usuario_id null cuando no hay usuario en sesión ni usuarioId explícito', async () => {
    mockCreateClient.mockReturnValue({
      auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: null } })) },
    })
    const insert = vi.fn(() => fakeQuery({}))
    mockCreateAdminClient.mockReturnValue({ from: vi.fn(() => ({ insert })) })

    await registrarAudit({ accion: 'LOGOUT', entidad: 'usuario' })

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ usuario_id: null }))
  })

  it('usa detalle y entidad_id vacíos por defecto (nunca undefined en el insert)', async () => {
    const insert = vi.fn(() => fakeQuery({}))
    mockCreateAdminClient.mockReturnValue({ from: vi.fn(() => ({ insert })) })

    await registrarAudit({ accion: 'EXPORT', entidad: 'entregable', usuarioId: 'u1' })

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ entidad_id: null, detalle: {} })
    )
  })

  it('propaga el detalle cuando se provee', async () => {
    const insert = vi.fn(() => fakeQuery({}))
    mockCreateAdminClient.mockReturnValue({ from: vi.fn(() => ({ insert })) })

    await registrarAudit({ accion: 'UPDATE', entidad: 'artefacto', usuarioId: 'u1', detalle: { campo: 'contenido' } })

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ detalle: { campo: 'contenido' } }))
  })
})

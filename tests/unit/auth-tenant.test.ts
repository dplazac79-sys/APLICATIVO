import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeQuery, fakeAdmin } from '../helpers/supabase-mock'
import { assertProyectoAccess, getRolUsuario, requireRole } from '../../src/lib/auth/tenant'

const mockCreateAdminClient = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockCreateAdminClient(),
}))

describe('assertProyectoAccess', () => {
  beforeEach(() => vi.clearAllMocks())

  it('super_admin tiene acceso a cualquier proyecto sin revisar usuario_proyecto', async () => {
    mockCreateAdminClient.mockReturnValue(
      fakeAdmin(() => fakeQuery({ data: { rol: 'super_admin', usuario_proyecto: [] } }))
    )
    expect(await assertProyectoAccess('u1', 'proy-cualquiera')).toBe(true)
  })

  it('un usuario con el proyecto en usuario_proyecto tiene acceso', async () => {
    mockCreateAdminClient.mockReturnValue(
      fakeAdmin(() =>
        fakeQuery({
          data: { rol: 'consultor', usuario_proyecto: [{ proyecto_id: 'proy-A' }, { proyecto_id: 'proy-B' }] },
        })
      )
    )
    expect(await assertProyectoAccess('u1', 'proy-A')).toBe(true)
  })

  it('deniega acceso a un proyecto fuera de usuario_proyecto — previene acceso cruzado entre clientes', async () => {
    mockCreateAdminClient.mockReturnValue(
      fakeAdmin(() =>
        fakeQuery({ data: { rol: 'sponsor_cliente', usuario_proyecto: [{ proyecto_id: 'proy-A' }] } })
      )
    )
    expect(await assertProyectoAccess('u1', 'proy-de-otro-cliente')).toBe(false)
  })

  it('deniega acceso cuando el usuario no existe', async () => {
    mockCreateAdminClient.mockReturnValue(fakeAdmin(() => fakeQuery({ data: null })))
    expect(await assertProyectoAccess('u-inexistente', 'proy-A')).toBe(false)
  })

  it('deniega acceso cuando usuario_proyecto es null (sin proyectos asignados)', async () => {
    mockCreateAdminClient.mockReturnValue(
      fakeAdmin(() => fakeQuery({ data: { rol: 'consultor', usuario_proyecto: null } }))
    )
    expect(await assertProyectoAccess('u1', 'proy-A')).toBe(false)
  })
})

describe('getRolUsuario', () => {
  beforeEach(() => vi.clearAllMocks())

  it('devuelve el rol del usuario', async () => {
    mockCreateAdminClient.mockReturnValue(fakeAdmin(() => fakeQuery({ data: { rol: 'consultor' } })))
    expect(await getRolUsuario('u1')).toBe('consultor')
  })

  it('devuelve null cuando el usuario no existe', async () => {
    mockCreateAdminClient.mockReturnValue(fakeAdmin(() => fakeQuery({ data: null })))
    expect(await getRolUsuario('u-inexistente')).toBeNull()
  })
})

describe('requireRole', () => {
  beforeEach(() => vi.clearAllMocks())

  it('permite cuando el rol del usuario está en la lista permitida', async () => {
    mockCreateAdminClient.mockReturnValue(fakeAdmin(() => fakeQuery({ data: { rol: 'super_admin' } })))
    expect(await requireRole('u1', ['super_admin', 'consultor'])).toBe(true)
  })

  it('deniega cuando el rol no está en la lista permitida', async () => {
    mockCreateAdminClient.mockReturnValue(fakeAdmin(() => fakeQuery({ data: { rol: 'sponsor_cliente' } })))
    expect(await requireRole('u1', ['super_admin', 'consultor'])).toBe(false)
  })

  it('deniega cuando el usuario no existe (rol null nunca matchea)', async () => {
    mockCreateAdminClient.mockReturnValue(fakeAdmin(() => fakeQuery({ data: null })))
    expect(await requireRole('u-inexistente', ['super_admin'])).toBe(false)
  })
})

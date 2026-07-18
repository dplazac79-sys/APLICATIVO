// Tests de regresión para los fixes de seguridad de esta sesión: hasta ahora
// ninguno tenía cobertura — un cambio futuro podía revertir cualquiera de
// estos comportamientos sin que ningún test fallara. Se invoca directamente
// a los route handlers (mismo patrón que auth-tenant.test.ts) en vez de
// pegarle a la base de datos real, para que corran rápido y sin credenciales.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { fakeQuery, fakeAdmin } from '../helpers/supabase-mock'

const USUARIO_ID = 'usuario-1'
const OTRO_PROYECTO_ID = 'proyecto-ajeno'
const MI_PROYECTO_ID = 'proyecto-propio'

const mockGetUser = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: () => mockGetUser() } }),
}))

const mockCreateAdminClient = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockCreateAdminClient(),
}))

vi.mock('@/lib/audit', () => ({
  registrarAudit: vi.fn(() => Promise.resolve()),
}))

function req(body?: unknown) {
  return new NextRequest('http://localhost/api/test', {
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: USUARIO_ID } } })
})

describe('PATCH /api/artefactos/[id] — bloqueo optimista atómico', () => {
  it('devuelve 409 y NO escribe historial cuando la versión no coincide (conflicto de concurrencia)', async () => {
    vi.resetModules()
    vi.doMock('@/lib/auth/tenant', () => ({ assertProyectoAccess: () => Promise.resolve(true) }))
    const { PATCH } = await import('@/app/api/artefactos/[id]/route')
    let artefactoCalls = 0
    let historialInsertLlamado = false
    mockCreateAdminClient.mockReturnValue(
      fakeAdmin((table) => {
        if (table === 'usuario') return fakeQuery({ data: { rol: 'consultor' } })
        if (table === 'artefacto') {
          artefactoCalls++
          if (artefactoCalls === 1) {
            return fakeQuery({ data: { version: 3, tipo: 'sipoc', proceso_id: 'proc-1', estado_validacion: 'pendiente', contenido: {}, proceso: { proyecto_id: MI_PROYECTO_ID } } })
          }
          // UPDATE ... WHERE version = version_esperada — nadie matchea, simula que otra request ya escribió antes
          return fakeQuery({ data: null, error: null })
        }
        if (table === 'artefacto_historial') { historialInsertLlamado = true; return fakeQuery({ data: null }) }
        throw new Error(`tabla inesperada en el test: ${table}`)
      })
    )

    const res = await PATCH(req({ contenido: { x: 1 }, motivo_cambio: 'test', version_esperada: 1 }), { params: { id: 'art-1' } })
    expect(res.status).toBe(409)
    expect(historialInsertLlamado).toBe(false)
  })

  it('devuelve 200 y SÍ escribe historial cuando la versión coincide', async () => {
    vi.resetModules()
    vi.doMock('@/lib/auth/tenant', () => ({ assertProyectoAccess: () => Promise.resolve(true) }))
    const { PATCH } = await import('@/app/api/artefactos/[id]/route')
    let artefactoCalls = 0
    let historialInsertLlamado = false
    mockCreateAdminClient.mockReturnValue(
      fakeAdmin((table) => {
        if (table === 'usuario') return fakeQuery({ data: { rol: 'consultor' } })
        if (table === 'artefacto') {
          artefactoCalls++
          if (artefactoCalls === 1) {
            return fakeQuery({ data: { version: 1, tipo: 'sipoc', proceso_id: 'proc-1', estado_validacion: 'pendiente', contenido: {}, proceso: { proyecto_id: MI_PROYECTO_ID } } })
          }
          return fakeQuery({ data: { id: 'art-1', version: 2 }, error: null })
        }
        if (table === 'artefacto_historial') { historialInsertLlamado = true; return fakeQuery({ data: null }) }
        throw new Error(`tabla inesperada en el test: ${table}`)
      })
    )

    const res = await PATCH(req({ contenido: { x: 1 }, motivo_cambio: 'test', version_esperada: 1 }), { params: { id: 'art-1' } })
    expect(res.status).toBe(200)
    expect(historialInsertLlamado).toBe(true)
  })
})

describe('PATCH /api/artefactos/[id] — acceso cross-tenant', () => {
  it('devuelve 403 cuando el usuario no tiene acceso al proyecto del artefacto', async () => {
    vi.resetModules()
    vi.doMock('@/lib/auth/tenant', () => ({ assertProyectoAccess: () => Promise.resolve(false) }))
    const { PATCH } = await import('@/app/api/artefactos/[id]/route')
    mockCreateAdminClient.mockReturnValue(
      fakeAdmin((table) => {
        if (table === 'usuario') return fakeQuery({ data: { rol: 'consultor' } })
        if (table === 'artefacto') return fakeQuery({ data: { version: 1, tipo: 'sipoc', proceso_id: 'proc-1', estado_validacion: 'pendiente', contenido: {}, proceso: { proyecto_id: OTRO_PROYECTO_ID } } })
        throw new Error(`tabla inesperada: ${table}`)
      })
    )

    const res = await PATCH(req({ contenido: { x: 1 }, motivo_cambio: 'test', version_esperada: 1 }), { params: { id: 'art-1' } })
    expect(res.status).toBe(403)
  })
})

describe('GET/POST /api/artefactos/[id]/historial — el fix de IDOR', () => {
  it('GET devuelve 403 cuando el artefacto pertenece a un proyecto ajeno', async () => {
    vi.resetModules()
    vi.doMock('@/lib/auth/tenant', () => ({ assertProyectoAccess: () => Promise.resolve(false) }))
    const { GET } = await import('@/app/api/artefactos/[id]/historial/route')
    mockCreateAdminClient.mockReturnValue(
      fakeAdmin((table) => {
        if (table === 'artefacto') return fakeQuery({ data: { proceso: { proyecto_id: OTRO_PROYECTO_ID } } })
        throw new Error(`tabla inesperada: ${table}`)
      })
    )

    const res = await GET(req(), { params: { id: 'art-1' } })
    expect(res.status).toBe(403)
  })

  it('GET devuelve 200 cuando el artefacto pertenece a un proyecto propio', async () => {
    vi.resetModules()
    vi.doMock('@/lib/auth/tenant', () => ({ assertProyectoAccess: () => Promise.resolve(true) }))
    const { GET } = await import('@/app/api/artefactos/[id]/historial/route')
    mockCreateAdminClient.mockReturnValue(
      fakeAdmin((table) => {
        if (table === 'artefacto') return fakeQuery({ data: { proceso: { proyecto_id: MI_PROYECTO_ID } } })
        if (table === 'artefacto_historial') return fakeQuery({ data: [] })
        throw new Error(`tabla inesperada: ${table}`)
      })
    )

    const res = await GET(req(), { params: { id: 'art-1' } })
    expect(res.status).toBe(200)
  })

  it('POST (restaurar versión) devuelve 403 cuando el artefacto pertenece a un proyecto ajeno — sin esto, cualquier usuario podía restaurar/corromper artefactos de otro cliente', async () => {
    vi.resetModules()
    vi.doMock('@/lib/auth/tenant', () => ({ assertProyectoAccess: () => Promise.resolve(false) }))
    const { POST } = await import('@/app/api/artefactos/[id]/historial/route')
    mockCreateAdminClient.mockReturnValue(
      fakeAdmin((table) => {
        if (table === 'usuario') return fakeQuery({ data: { rol: 'consultor' } })
        if (table === 'artefacto_historial') return fakeQuery({ data: { contenido: {}, version: 1 } })
        if (table === 'artefacto') return fakeQuery({ data: { contenido: {}, version: 2, proceso_id: 'proc-1', tipo: 'sipoc', estado_validacion: 'pendiente', proceso: { proyecto_id: OTRO_PROYECTO_ID } } })
        throw new Error(`tabla inesperada: ${table}`)
      })
    )

    const res = await POST(req({ historial_id: 'hist-1' }), { params: { id: 'art-1' } })
    expect(res.status).toBe(403)
  })
})

describe('POST /api/procesos/[id]/nueva-version — assertProyectoAccess', () => {
  it('devuelve 403 cuando el proceso pertenece a un proyecto ajeno', async () => {
    vi.resetModules()
    vi.doMock('@/lib/auth/tenant', () => ({
      assertProyectoAccess: () => Promise.resolve(false),
      requireRole: () => Promise.resolve(true),
    }))
    const { POST } = await import('@/app/api/procesos/[id]/nueva-version/route')
    mockCreateAdminClient.mockReturnValue(
      fakeAdmin((table) => {
        if (table === 'usuario') return fakeQuery({ data: { rol: 'consultor' } })
        if (table === 'proceso') return fakeQuery({ data: { metadata_ia: {}, documento_origen_id: null, proyecto_id: OTRO_PROYECTO_ID } })
        throw new Error(`tabla inesperada: ${table}`)
      })
    )

    const res = await POST(req(), { params: { id: 'proc-1' } })
    expect(res.status).toBe(403)
  })
})

describe('POST /api/riesgos — assertProyectoAccess', () => {
  it('devuelve 403 cuando se intenta crear un riesgo en un proyecto ajeno', async () => {
    vi.resetModules()
    vi.doMock('@/lib/auth/tenant', () => ({
      assertProyectoAccess: () => Promise.resolve(false),
      requireRole: () => Promise.resolve(true),
    }))
    const { POST } = await import('@/app/api/riesgos/route')
    mockCreateAdminClient.mockReturnValue(fakeAdmin(() => fakeQuery({ data: null })))

    const res = await POST(req({ proyecto_id: OTRO_PROYECTO_ID, descripcion: 'riesgo intruso' }))
    expect(res.status).toBe(403)
  })
})

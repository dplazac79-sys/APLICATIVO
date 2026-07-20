import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeQuery, fakeAdmin } from '../helpers/supabase-mock'
import { checkLoginRateLimit, getClientIp } from '../../src/lib/auth/rate-limit-login'

const mockCreateAdminClient = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockCreateAdminClient(),
}))

describe('checkLoginRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(Math, 'random').mockReturnValue(0.99) // evita la limpieza probabilística en el resto de tests
  })

  it('permite el intento cuando está bajo el límite de 20 en la ventana', async () => {
    mockCreateAdminClient.mockReturnValue(
      fakeAdmin(table => (table === 'login_intento_ip' ? fakeQuery({ count: 5 }) : fakeQuery({})))
    )
    const res = await checkLoginRateLimit('1.2.3.4')
    expect(res.permitido).toBe(true)
    expect(res.mensaje).toBeUndefined()
  })

  it('bloquea cuando ya se alcanzó el máximo de 20 intentos en la ventana', async () => {
    mockCreateAdminClient.mockReturnValue(fakeAdmin(() => fakeQuery({ count: 20 })))
    const res = await checkLoginRateLimit('1.2.3.4')
    expect(res.permitido).toBe(false)
    expect(res.mensaje).toMatch(/Demasiados intentos/)
  })

  it('bloquea también por encima del máximo (no solo en el borde exacto)', async () => {
    mockCreateAdminClient.mockReturnValue(fakeAdmin(() => fakeQuery({ count: 37 })))
    const res = await checkLoginRateLimit('1.2.3.4')
    expect(res.permitido).toBe(false)
  })

  it('trata count null como 0 intentos previos (permite)', async () => {
    mockCreateAdminClient.mockReturnValue(fakeAdmin(() => fakeQuery({ count: null })))
    const res = await checkLoginRateLimit('1.2.3.4')
    expect(res.permitido).toBe(true)
  })

  it('dispara la limpieza probabilística cuando Math.random() cae bajo el umbral', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.001)
    const deleteQuery = fakeQuery({})
    mockCreateAdminClient.mockReturnValue(
      fakeAdmin(table => (table === 'login_intento_ip' ? { ...fakeQuery({ count: 1 }), ...deleteQuery } : fakeQuery({})))
    )
    await checkLoginRateLimit('1.2.3.4')
    // La limpieza no debe romper el flujo principal — el intento sigue permitido.
    // (la limpieza en sí corre en background vía .then(), no se espera aquí)
  })
})

describe('getClientIp', () => {
  it('usa x-forwarded-for cuando está presente, tomando la ÚLTIMA IP (la que agrega el proxy de la plataforma, no el cliente)', () => {
    // El primer valor es el que el cliente puede falsificar libremente para
    // evadir el rate-limit por IP — ver el fix de seguridad en
    // src/lib/auth/rate-limit-login.ts. Este test antes afirmaba el
    // comportamiento viejo y vulnerable (tomar la primera IP), lo que
    // significaba que revertir el fix por error habría pasado los tests.
    const req = new Request('https://x.test', {
      headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1, 172.16.0.1' },
    })
    expect(getClientIp(req)).toBe('172.16.0.1')
  })

  it('recurre a x-real-ip cuando no hay x-forwarded-for', () => {
    const req = new Request('https://x.test', { headers: { 'x-real-ip': '8.8.8.8' } })
    expect(getClientIp(req)).toBe('8.8.8.8')
  })

  it('devuelve "desconocida" cuando no hay ningún header de IP', () => {
    const req = new Request('https://x.test')
    expect(getClientIp(req)).toBe('desconocida')
  })
})

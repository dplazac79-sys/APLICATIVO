import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const send = vi.fn(() => Promise.resolve({ data: { id: 'email-1' }, error: null }))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send }
  },
}))

describe('enviarEmail', () => {
  const originalKey = process.env.RESEND_API_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    process.env.RESEND_API_KEY = originalKey
  })

  it('no envía nada (silencioso) cuando RESEND_API_KEY no está configurada', async () => {
    delete process.env.RESEND_API_KEY
    const { enviarEmail } = await import('../../src/lib/email')
    await enviarEmail({ to: 'x@y.com', subject: 'Asunto', html: '<p>hola</p>' })
    expect(send).not.toHaveBeenCalled()
  })

  it('envía el email vía Resend cuando la API key está configurada', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    const { enviarEmail } = await import('../../src/lib/email')
    await enviarEmail({ to: 'x@y.com', subject: 'Asunto', html: '<p>hola</p>' })
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: ['x@y.com'], subject: 'Asunto', html: '<p>hola</p>' })
    )
  })

  it('normaliza un único destinatario string a array', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    const { enviarEmail } = await import('../../src/lib/email')
    await enviarEmail({ to: 'solo@uno.com', subject: 'S', html: 'h' })
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: ['solo@uno.com'] }))
  })

  it('preserva un array de destinatarios', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    const { enviarEmail } = await import('../../src/lib/email')
    await enviarEmail({ to: ['a@x.com', 'b@x.com'], subject: 'S', html: 'h' })
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: ['a@x.com', 'b@x.com'] }))
  })

  it('no lanza si Resend falla — el envío de email nunca debe bloquear el flujo principal', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    send.mockRejectedValueOnce(new Error('Resend caído'))
    const { enviarEmail } = await import('../../src/lib/email')
    await expect(enviarEmail({ to: 'x@y.com', subject: 'S', html: 'h' })).resolves.not.toThrow()
  })
})

describe('templates de email', () => {
  it('templateCambioEstado incluye proyecto, estados y usuario', async () => {
    const { templateCambioEstado } = await import('../../src/lib/email')
    const html = templateCambioEstado({
      proyecto: 'Cadena de Suministro',
      estado_anterior: 'en_curso',
      estado_nuevo: 'completado',
      usuario: 'María Fernanda',
    })
    expect(html).toContain('Cadena de Suministro')
    expect(html).toContain('en_curso')
    expect(html).toContain('completado')
    expect(html).toContain('María Fernanda')
  })

  it('templateCambioEstado omite el botón cuando no se pasa url', async () => {
    const { templateCambioEstado } = await import('../../src/lib/email')
    const html = templateCambioEstado({
      proyecto: 'P', estado_anterior: 'a', estado_nuevo: 'b', usuario: 'u',
    })
    expect(html).not.toContain('<a href')
  })

  it('templateCambioEstado incluye el botón con la url cuando se pasa', async () => {
    const { templateCambioEstado } = await import('../../src/lib/email')
    const html = templateCambioEstado({
      proyecto: 'P', estado_anterior: 'a', estado_nuevo: 'b', usuario: 'u', url: 'https://app.test/p/1',
    })
    expect(html).toContain('href="https://app.test/p/1"')
  })

  it('templateEscalacion incluye nivel y descripción', async () => {
    const { templateEscalacion } = await import('../../src/lib/email')
    const html = templateEscalacion({ proyecto: 'P', nivel: 'crítica', descripcion: 'Bloqueo total' })
    expect(html).toContain('crítica')
    expect(html).toContain('Bloqueo total')
  })

  it('templateNuevaAsignacion incluye proyecto, rol y quien asignó', async () => {
    const { templateNuevaAsignacion } = await import('../../src/lib/email')
    const html = templateNuevaAsignacion({ proyecto: 'P', rol: 'consultor', asignado_por: 'Ana' })
    expect(html).toContain('P')
    expect(html).toContain('consultor')
    expect(html).toContain('Ana')
  })
})

import { describe, it, expect, vi } from 'vitest'
import { jsonError } from '../../src/lib/http/errors'

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status }),
  },
}))

describe('jsonError', () => {
  it('para status >= 500 nunca expone el mensaje crudo del error', () => {
    const res = jsonError(new Error('relation "documento" does not exist'), 500) as unknown as {
      body: { error: string }
      status: number
    }
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Error interno del servidor')
  })

  it('para status < 500 preserva el mensaje del Error', () => {
    const res = jsonError(new Error('Proceso no encontrado'), 404) as unknown as {
      body: { error: string }
      status: number
    }
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Proceso no encontrado')
  })

  it('respeta publicMessage explícito incluso en 500', () => {
    const res = jsonError(new Error('detalle interno'), 500, 'No se pudo procesar la solicitud') as unknown as {
      body: { error: string }
      status: number
    }
    expect(res.body.error).toBe('No se pudo procesar la solicitud')
  })

  it('maneja errores que no son instancias de Error', () => {
    const res = jsonError('string plano', 400) as unknown as { body: { error: string }; status: number }
    expect(res.body.error).toBe('string plano')
  })

  it('usa status 500 por defecto', () => {
    const res = jsonError(new Error('x')) as unknown as { status: number }
    expect(res.status).toBe(500)
  })
})

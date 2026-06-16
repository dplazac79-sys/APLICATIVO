import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generarEmbedding } from '@/lib/ai/embeddings'

describe('generarEmbedding', () => {
  const originalFetch = global.fetch
  const originalKey = process.env.VOYAGE_API_KEY

  beforeEach(() => {
    process.env.VOYAGE_API_KEY = 'test-voyage-key'
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env.VOYAGE_API_KEY = originalKey
  })

  it('lanza error si no hay VOYAGE_API_KEY configurada', async () => {
    delete process.env.VOYAGE_API_KEY
    await expect(generarEmbedding('texto de prueba')).rejects.toThrow('VOYAGE_API_KEY')
  })

  it('retorna el vector de embedding cuando la API responde correctamente', async () => {
    const vectorFalso = Array.from({ length: 1024 }, (_, i) => i / 1024)
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: vectorFalso }] }),
    }) as unknown as typeof fetch

    const resultado = await generarEmbedding('texto de prueba')
    expect(resultado).toHaveLength(1024)
    expect(resultado[1]).toBeCloseTo(1 / 1024)
  })

  it('lanza error legible cuando la API de Voyage responde con error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    }) as unknown as typeof fetch

    await expect(generarEmbedding('texto de prueba')).rejects.toThrow(/Voyage AI error 401/)
  })
})

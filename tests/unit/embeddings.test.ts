import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generarEmbedding, EMBEDDING_DIMENSIONS } from '@/lib/ai/embeddings'

// La implementación actual usa Voyage AI (voyage-3) vía fetch HTTP directo —
// reemplazó al modelo local Xenova/Transformers.js que este archivo mockeaba
// antes. El test viejo mockeaba un paquete que el código ya no importa, así
// que nunca verificó nada real: fallaba con 'VOYAGE_API_KEY no configurada'
// en cualquier entorno sin esa key, incluyendo CI.

const mockFetchResponse = (embedding: number[]) => ({
  ok: true,
  json: async () => ({ data: [{ embedding }] }),
})

describe('generarEmbedding (Voyage AI)', () => {
  beforeEach(() => {
    process.env.VOYAGE_API_KEY = 'test-key'
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('EMBEDDING_DIMENSIONS es 1024 (voyage-3)', () => {
    expect(EMBEDDING_DIMENSIONS).toBe(1024)
  })

  it('retorna un vector de 1024 dimensiones', async () => {
    const fakeEmbedding = new Array(EMBEDDING_DIMENSIONS).fill(0.1)
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(fakeEmbedding) as unknown as Response)

    const resultado = await generarEmbedding('texto de prueba')
    expect(resultado).toHaveLength(EMBEDDING_DIMENSIONS)
    expect(resultado[0]).toBeCloseTo(0.1)
  })

  it('acepta inputType opcional sin error', async () => {
    const fakeEmbedding = new Array(EMBEDDING_DIMENSIONS).fill(0.2)
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(fakeEmbedding) as unknown as Response)

    const resultado = await generarEmbedding('texto de prueba', 'query')
    expect(resultado).toHaveLength(EMBEDDING_DIMENSIONS)
  })

  it('lanza error explícito si falta VOYAGE_API_KEY', async () => {
    delete process.env.VOYAGE_API_KEY
    await expect(generarEmbedding('texto')).rejects.toThrow('VOYAGE_API_KEY no configurada')
  })

  it('lanza error explícito si Voyage AI responde con error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Provided API key is invalid.',
    } as unknown as Response)

    await expect(generarEmbedding('texto')).rejects.toThrow(/Voyage AI error 401/)
  })
})

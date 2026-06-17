import { describe, it, expect, vi } from 'vitest'
import { generarEmbedding, EMBEDDING_DIMENSIONS } from '@/lib/ai/embeddings'

vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn().mockResolvedValue(
    vi.fn().mockResolvedValue({
      data: new Float32Array(EMBEDDING_DIMENSIONS).fill(0.1),
    })
  ),
  env: { useBrowserCache: true, allowLocalModels: true },
}))

describe('generarEmbedding (local Transformers.js)', () => {
  it('retorna un vector de 384 dimensiones', async () => {
    const resultado = await generarEmbedding('texto de prueba')
    expect(resultado).toHaveLength(EMBEDDING_DIMENSIONS)
    expect(resultado[0]).toBeCloseTo(0.1)
  })

  it('acepta parámetro _inputType opcional sin error', async () => {
    const resultado = await generarEmbedding('texto de prueba', 'query')
    expect(resultado).toHaveLength(EMBEDDING_DIMENSIONS)
  })

  it('EMBEDDING_DIMENSIONS es 384', () => {
    expect(EMBEDDING_DIMENSIONS).toBe(384)
  })
})

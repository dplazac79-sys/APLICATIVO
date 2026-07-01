/**
 * Embeddings via Voyage AI (voyage-3) — 1024 dimensiones, optimizado para inglés y español
 * Reemplaza el modelo local Xenova (384-dim, solo inglés) que no coincidía con el schema vector(1024)
 * API: https://api.voyageai.com/v1/embeddings
 * Key: VOYAGE_API_KEY (env var)
 */

export const EMBEDDING_DIMENSIONS = 1024

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings'
const VOYAGE_MODEL = 'voyage-3'

export async function generarEmbedding(
  texto: string,
  inputType: 'document' | 'query' = 'document'
): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) throw new Error('VOYAGE_API_KEY no configurada')

  const res = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: [texto.slice(0, 32000)], // voyage-3 soporta hasta 32k tokens
      input_type: inputType,          // 'document' para indexar, 'query' para buscar
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Voyage AI error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.data[0].embedding as number[]
}

/**
 * Genera embeddings para múltiples textos en batch (más eficiente que llamadas individuales)
 * Voyage AI acepta hasta 128 inputs por request
 */
export async function generarEmbeddingsBatch(
  textos: string[],
  inputType: 'document' | 'query' = 'document'
): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) throw new Error('VOYAGE_API_KEY no configurada')

  const BATCH_SIZE = 128
  const resultados: number[][] = []

  for (let i = 0; i < textos.length; i += BATCH_SIZE) {
    const batch = textos.slice(i, i + BATCH_SIZE)
    const res = await fetch(VOYAGE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: VOYAGE_MODEL,
        input: batch.map(t => t.slice(0, 32000)),
        input_type: inputType,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Voyage AI batch error ${res.status}: ${err}`)
    }

    const data = await res.json()
    resultados.push(...data.data.map((d: { embedding: number[] }) => d.embedding))
  }

  return resultados
}

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings'
const VOYAGE_MODEL = 'voyage-3'
export const EMBEDDING_DIMENSIONS = 1024

export async function generarEmbedding(texto: string, inputType: 'document' | 'query' = 'document'): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) throw new Error('VOYAGE_API_KEY no configurada')

  const res = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: [texto.slice(0, 16000)],
      model: VOYAGE_MODEL,
      input_type: inputType,
    }),
  })

  if (!res.ok) {
    const detalle = await res.text()
    throw new Error(`Voyage AI error ${res.status}: ${detalle}`)
  }

  const data = await res.json()
  return data.data[0].embedding as number[]
}

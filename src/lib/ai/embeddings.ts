export const EMBEDDING_DIMENSIONS = 384

// Singleton: se inicializa una vez y se reutiliza entre requests del mismo proceso
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractorPromise: Promise<any> | null = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getExtractor(): Promise<any> {
  if (!extractorPromise) {
    // Importación dinámica necesaria: @xenova/transformers es ESM puro y
    // usa onnxruntime-node (binario nativo), no puede ser bundleado por webpack.
    const { pipeline, env } = await import('@xenova/transformers')
    env.useBrowserCache = false
    env.allowLocalModels = false
    extractorPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true })
  }
  return extractorPromise
}

export async function generarEmbedding(
  texto: string,
  // inputType era parámetro de Voyage AI (document vs query); con modelo local no hay distinción
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _inputType?: 'document' | 'query'
): Promise<number[]> {
  const extractor = await getExtractor()
  const output = await extractor(texto.slice(0, 8192), { pooling: 'mean', normalize: true })
  return Array.from(output.data as Float32Array)
}

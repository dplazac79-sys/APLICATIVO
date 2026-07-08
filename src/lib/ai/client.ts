/**
 * Cliente de IA unificado.
 * Usa Together AI si TOGETHER_API_KEY está disponible (producción).
 * Fallback a Groq si solo GROQ_API_KEY está disponible.
 */
import OpenAI from 'openai'
import Groq from 'groq-sdk'

// Together AI — OpenAI-compatible, sin rate limits en plan de pago
const TOGETHER_KEY = process.env.TOGETHER_API_KEY
const GROQ_KEY     = process.env.GROQ_API_KEY

export const usesTogetherAI = !!TOGETHER_KEY

// Cliente Together AI (interfaz OpenAI)
export const togetherClient = TOGETHER_KEY
  ? new OpenAI({
      apiKey: TOGETHER_KEY,
      baseURL: 'https://api.together.xyz/v1',
      timeout: 8000,    // 8s por request — falla rápido, el template garantiza el resultado
      maxRetries: 0,    // manejamos retries manualmente
    })
  : null

// Cliente Groq (fallback sin Together AI)
export const groqClient = GROQ_KEY ? new Groq({ apiKey: GROQ_KEY }) : null

// Modelos serverless confirmados en Together AI
export const MODELOS_TOGETHER = {
  potente: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  rapido:  'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free', // serverless gratuito como fallback
} as const

// Modelos Groq (fallback)
export const MODELOS_GROQ = {
  potente: 'llama-3.3-70b-versatile',
  rapido:  'llama-3.1-8b-instant',
} as const

export const MODELOS = {
  potente: usesTogetherAI ? MODELOS_TOGETHER.potente : MODELOS_GROQ.potente,
  rapido:  usesTogetherAI ? MODELOS_TOGETHER.rapido  : MODELOS_GROQ.rapido,
} as const

/**
 * Llamada unificada de chat completion.
 * Usa Together AI si está configurado; si falla, hace fallback automático a Groq.
 */
export async function chatCompletion(params: {
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  max_tokens?: number
  temperature?: number
  response_format?: { type: 'json_object' }
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[]
  tool_choice?: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption
}): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  // Intentar Together AI primero
  if (togetherClient) {
    try {
      return await togetherClient.chat.completions.create(
        params as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
      )
    } catch (err) {
      // Si falla por modelo no-serverless o rate limit, hacer fallback a Groq
      const msg = err instanceof Error ? err.message : String(err)
      const esErrorRecuperable = msg.includes('non-serverless') || msg.includes('429') || msg.includes('rate') || msg.includes('timeout') || msg.includes('503')
      if (!esErrorRecuperable) throw err // error de autenticación u otro — propagar
      // Continuar al fallback de Groq
    }
  }
  // Fallback: Groq con modelo equivalente
  if (groqClient) {
    // Mapear modelo Together → Groq
    const modeloGroq = params.model.includes('70B') ? MODELOS_GROQ.potente : MODELOS_GROQ.rapido
    return groqClient.chat.completions.create({
      ...params,
      model: modeloGroq,
    } as Parameters<typeof groqClient.chat.completions.create>[0]) as unknown as OpenAI.Chat.Completions.ChatCompletion
  }
  throw new Error('No hay proveedor de IA configurado. Configura TOGETHER_API_KEY o GROQ_API_KEY.')
}

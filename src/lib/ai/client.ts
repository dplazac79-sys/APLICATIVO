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

export const MODELOS = {
  // Llama-3.3-70B: mejor modelo de Together AI para JSON estructurado complejo
  potente: usesTogetherAI ? 'meta-llama/Llama-3.3-70B-Instruct-Turbo'      : 'llama-3.3-70b-versatile',
  // Llama-3.1-8B: fallback rápido para tareas simples
  rapido:  usesTogetherAI ? 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo'  : 'llama-3.1-8b-instant',
} as const

/**
 * Llamada unificada de chat completion.
 * Usa Together AI si está configurado, si no usa Groq.
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
  if (togetherClient) {
    return togetherClient.chat.completions.create(params as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming)
  }
  if (groqClient) {
    // Groq SDK tiene la misma interfaz OpenAI-compatible
    return groqClient.chat.completions.create(params as Parameters<typeof groqClient.chat.completions.create>[0]) as unknown as OpenAI.Chat.Completions.ChatCompletion
  }
  throw new Error('No hay proveedor de IA configurado. Configura TOGETHER_API_KEY o GROQ_API_KEY.')
}

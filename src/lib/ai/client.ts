/**
 * Cliente de IA unificado.
 * Usa Together AI si TOGETHER_API_KEY está disponible (producción).
 * Fallback a Groq si solo GROQ_API_KEY está disponible.
 */
import OpenAI from 'openai'
import Groq from 'groq-sdk'

// Together AI — OpenAI-compatible, sin rate limits agresivos en plan de pago
const TOGETHER_KEY = process.env.TOGETHER_API_KEY
const GROQ_KEY     = process.env.GROQ_API_KEY

export const usesTogetherAI = !!TOGETHER_KEY

// Cliente Together AI (interfaz OpenAI)
export const togetherClient = TOGETHER_KEY
  ? new OpenAI({
      apiKey: TOGETHER_KEY,
      baseURL: 'https://api.together.xyz/v1',
    })
  : null

// Cliente Groq (fallback)
export const groqClient = GROQ_KEY ? new Groq({ apiKey: GROQ_KEY }) : null

// Modelos equivalentes
export const MODELOS = {
  rapido:  usesTogetherAI ? 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo'  : 'llama-3.1-8b-instant',
  potente: usesTogetherAI ? 'meta-llama/Llama-3.3-70B-Instruct-Turbo'       : 'llama-3.3-70b-versatile',
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

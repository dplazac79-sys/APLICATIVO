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

// Cliente Together AI — modelo pagado, sin límites de serverless
export const togetherClient = TOGETHER_KEY
  ? new OpenAI({
      apiKey: TOGETHER_KEY,
      baseURL: 'https://api.together.xyz/v1',
      timeout: 90_000,  // 90s — prompts complejos (BPMN, discovery) pueden tardar
      maxRetries: 0,    // reintentos manuales con backoff exponencial abajo
    })
  : null

// Cliente Groq (emergencia si Together AI está caído)
export const groqClient = GROQ_KEY ? new Groq({ apiKey: GROQ_KEY }) : null

// Modelo pagado Together AI — aplica tanto a llamadas potentes como rápidas
const MODELO_TOGETHER_PAGADO = 'meta-llama/Llama-3.3-70B-Instruct-Turbo'

export const MODELOS_TOGETHER = {
  potente: MODELO_TOGETHER_PAGADO,
  rapido:  MODELO_TOGETHER_PAGADO,
} as const

// Modelos Groq (emergencia)
export const MODELOS_GROQ = {
  potente: 'llama-3.3-70b-versatile',
  rapido:  'llama-3.1-8b-instant',
} as const

export const MODELOS = {
  potente: usesTogetherAI ? MODELOS_TOGETHER.potente : MODELOS_GROQ.potente,
  rapido:  usesTogetherAI ? MODELOS_TOGETHER.rapido  : MODELOS_GROQ.rapido,
} as const

/** Pausa en ms */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Llamada unificada de chat completion con reintentos automáticos.
 * Proveedor principal: Together AI (modelo pagado, sin rate limits).
 * Fallback de emergencia: Groq (solo si Together AI está caído).
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
    const MAX_INTENTOS = 3
    let ultimoError: unknown

    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      try {
        return await togetherClient.chat.completions.create(
          params as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
        )
      } catch (err) {
        ultimoError = err
        const msg = err instanceof Error ? err.message : String(err)

        // Errores no recuperables — no reintentar
        if (msg.includes('401') || msg.includes('invalid_api_key') || msg.includes('403')) {
          throw new Error(`Together AI: credenciales inválidas — ${msg}`)
        }

        // En el último intento no esperar
        if (intento < MAX_INTENTOS) {
          const espera = intento * 2000 // 2s, 4s
          await sleep(espera)
        }
      }
    }

    // Together AI falló 3 veces — intentar Groq como emergencia
    if (groqClient) {
      const modeloGroq = params.model.includes('70B') ? MODELOS_GROQ.potente : MODELOS_GROQ.rapido
      return groqClient.chat.completions.create({
        ...params,
        model: modeloGroq,
      } as Parameters<typeof groqClient.chat.completions.create>[0]) as unknown as OpenAI.Chat.Completions.ChatCompletion
    }

    throw ultimoError ?? new Error('Together AI no disponible')
  }

  // Sin Together AI — usar Groq directamente
  if (groqClient) {
    const modeloGroq = params.model.includes('70B') ? MODELOS_GROQ.potente : MODELOS_GROQ.rapido
    return groqClient.chat.completions.create({
      ...params,
      model: modeloGroq,
    } as Parameters<typeof groqClient.chat.completions.create>[0]) as unknown as OpenAI.Chat.Completions.ChatCompletion
  }

  throw new Error('No hay proveedor de IA configurado. Configura TOGETHER_API_KEY o GROQ_API_KEY.')
}

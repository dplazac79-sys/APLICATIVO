import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const togetherCreate = vi.fn()
const groqCreate = vi.fn()

vi.mock('openai', () => ({
  default: class OpenAI {
    chat = { completions: { create: togetherCreate } }
  },
}))
vi.mock('groq-sdk', () => ({
  default: class Groq {
    chat = { completions: { create: groqCreate } }
  },
}))

const ORIGINAL_ENV = { ...process.env }

async function cargarClienteConEnv(env: Record<string, string | undefined>) {
  vi.resetModules()
  process.env = { ...ORIGINAL_ENV, ...env }
  return import('../../src/lib/ai/client')
}

describe('chatCompletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    process.env = { ...ORIGINAL_ENV }
  })

  it('usa Together AI cuando TOGETHER_API_KEY está configurada', async () => {
    const { chatCompletion } = await cargarClienteConEnv({ TOGETHER_API_KEY: 'tk', GROQ_API_KEY: undefined })
    togetherCreate.mockResolvedValue({ choices: [{ message: { content: 'ok' } }] })

    const res = await chatCompletion({ model: 'm', messages: [{ role: 'user', content: 'hola' }] })

    expect(togetherCreate).toHaveBeenCalledTimes(1)
    expect(groqCreate).not.toHaveBeenCalled()
    expect(res.choices[0].message.content).toBe('ok')
  })

  it('usa Groq directamente cuando no hay TOGETHER_API_KEY pero sí GROQ_API_KEY', async () => {
    const { chatCompletion } = await cargarClienteConEnv({ TOGETHER_API_KEY: undefined, GROQ_API_KEY: 'gk' })
    groqCreate.mockResolvedValue({ choices: [{ message: { content: 'ok-groq' } }] })

    const res = await chatCompletion({ model: 'm', messages: [{ role: 'user', content: 'hola' }] })

    expect(togetherCreate).not.toHaveBeenCalled()
    expect(groqCreate).toHaveBeenCalledTimes(1)
    expect(res.choices[0].message.content).toBe('ok-groq')
  })

  it('lanza error inmediato sin reintentar cuando Together AI responde 401 (credenciales inválidas)', async () => {
    const { chatCompletion } = await cargarClienteConEnv({ TOGETHER_API_KEY: 'tk-mala', GROQ_API_KEY: undefined })
    togetherCreate.mockRejectedValue(new Error('401 unauthorized'))

    await expect(
      chatCompletion({ model: 'm', messages: [{ role: 'user', content: 'x' }] })
    ).rejects.toThrow(/credenciales inválidas/)

    expect(togetherCreate).toHaveBeenCalledTimes(1) // ni un reintento
  })

  it('reintenta hasta 3 veces ante errores transitorios antes de rendirse', async () => {
    const { chatCompletion } = await cargarClienteConEnv({ TOGETHER_API_KEY: 'tk', GROQ_API_KEY: undefined })
    togetherCreate.mockRejectedValue(new Error('500 internal server error'))

    const promise = chatCompletion({ model: 'm', messages: [{ role: 'user', content: 'x' }] })
    const assertion = expect(promise).rejects.toThrow(/500/) // adjunta el handler antes de que rechace
    // deja avanzar los sleeps entre reintentos (2s, 4s) bajo fake timers
    await vi.runAllTimersAsync()
    await assertion

    expect(togetherCreate).toHaveBeenCalledTimes(3)
  })

  it('recurre a Groq como emergencia si Together AI falla 3 veces y Groq está configurado', async () => {
    const { chatCompletion } = await cargarClienteConEnv({ TOGETHER_API_KEY: 'tk', GROQ_API_KEY: 'gk' })
    togetherCreate.mockRejectedValue(new Error('503 unavailable'))
    groqCreate.mockResolvedValue({ choices: [{ message: { content: 'rescatado-por-groq' } }] })

    const promise = chatCompletion({ model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', messages: [{ role: 'user', content: 'x' }] })
    await vi.runAllTimersAsync()
    const res = await promise

    expect(togetherCreate).toHaveBeenCalledTimes(3)
    expect(groqCreate).toHaveBeenCalledTimes(1)
    expect(res.choices[0].message.content).toBe('rescatado-por-groq')
  })

  it('lanza cuando ningún proveedor de IA está configurado', async () => {
    const { chatCompletion } = await cargarClienteConEnv({ TOGETHER_API_KEY: undefined, GROQ_API_KEY: undefined })
    await expect(
      chatCompletion({ model: 'm', messages: [{ role: 'user', content: 'x' }] })
    ).rejects.toThrow(/No hay proveedor de IA configurado/)
  })

  it('usesTogetherAI refleja la presencia de TOGETHER_API_KEY', async () => {
    const conTogether = await cargarClienteConEnv({ TOGETHER_API_KEY: 'tk' })
    expect(conTogether.usesTogetherAI).toBe(true)

    const sinTogether = await cargarClienteConEnv({ TOGETHER_API_KEY: undefined, GROQ_API_KEY: 'gk' })
    expect(sinTogether.usesTogetherAI).toBe(false)
  })
})

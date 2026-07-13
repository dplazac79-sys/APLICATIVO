import { describe, it, expect, beforeEach, vi } from 'vitest'

const REQUERIDAS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

function setEnvCompleto() {
  for (const k of REQUERIDAS) process.env[k] = `valor-${k}`
}

describe('validarEnvCritico', () => {
  beforeEach(() => {
    vi.resetModules()
    for (const k of REQUERIDAS) delete process.env[k]
  })

  it('no lanza cuando todas las variables requeridas están presentes', async () => {
    setEnvCompleto()
    const { validarEnvCritico } = await import('../../src/lib/env')
    expect(() => validarEnvCritico()).not.toThrow()
  })

  it('lanza un error listando las variables faltantes', async () => {
    setEnvCompleto()
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const { validarEnvCritico } = await import('../../src/lib/env')
    expect(() => validarEnvCritico()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/)
  })

  it('lista todas las variables faltantes en un solo error', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_URL
    const { validarEnvCritico } = await import('../../src/lib/env')
    try {
      validarEnvCritico()
      expect.unreachable()
    } catch (e) {
      expect((e as Error).message).toMatch(/NEXT_PUBLIC_SUPABASE_URL/)
      expect((e as Error).message).toMatch(/SUPABASE_URL/)
    }
  })

  it('solo valida una vez por proceso (memoiza tras el primer éxito)', async () => {
    setEnvCompleto()
    const { validarEnvCritico } = await import('../../src/lib/env')
    validarEnvCritico()
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    expect(() => validarEnvCritico()).not.toThrow()
  })
})

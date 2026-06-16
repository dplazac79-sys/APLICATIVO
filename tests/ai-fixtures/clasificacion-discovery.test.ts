import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import { clasificarDocumento, resumirDocumento, discoveryProcesos } from '@/lib/ai/claude'

const FIXTURES = [
  { nombre: 'retail.txt', industriaEsperada: /retail|vestuario|comercio/i },
  { nombre: 'salud.txt', industriaEsperada: /salud|clínica|cl[ií]nic/i },
  { nombre: 'banca.txt', industriaEsperada: /banc|financ/i },
]

beforeAll(() => {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'test-key-placeholder') {
    throw new Error('ANTHROPIC_API_KEY real requerida para tests:ai (estos tests llaman a la API de Claude de verdad)')
  }
})

describe.each(FIXTURES)('Fixture de industria: $nombre', ({ nombre, industriaEsperada }) => {
  const texto = fs.readFileSync(path.join(process.cwd(), 'tests/fixtures', nombre), 'utf-8')

  it('clasifica el documento con un bloque metodológico y confianza válidos', async () => {
    const clasificacion = await clasificarDocumento(texto)

    expect(typeof clasificacion.bloque).toBe('string')
    expect(clasificacion.bloque.length).toBeGreaterThan(0)
    expect(clasificacion.confianza).toBeGreaterThan(0)
    expect(clasificacion.confianza).toBeLessThanOrEqual(1)
    expect(Array.isArray(clasificacion.palabras_clave)).toBe(true)
  }, 60000)

  it('genera un resumen ejecutivo con diagnóstico de madurez consistente', async () => {
    const resumen = await resumirDocumento(texto)

    expect(resumen.resumen_ejecutivo.length).toBeGreaterThan(50)
    expect(resumen.nivel_madurez_amo).toBeGreaterThanOrEqual(1)
    expect(resumen.nivel_madurez_amo).toBeLessThanOrEqual(5)
    expect(resumen.hallazgos_criticos.length).toBeGreaterThan(0)
    expect(resumen.riesgos_criticos.length).toBeGreaterThan(0)
  }, 60000)

  it('Process Discovery AI detecta la industria correcta y produce inventario nivel 0-1', async () => {
    const resumen = await resumirDocumento(texto)
    const contexto = `Documento de prueba: ${nombre}`

    const resultado = await discoveryProcesos(contexto, [resumen.resumen_ejecutivo])

    expect(resultado.industria_detectada).toMatch(industriaEsperada)
    expect(resultado.macroprocesos.length).toBeGreaterThanOrEqual(3)

    const totalProcesosNivel1 = resultado.macroprocesos.reduce((acc, m) => acc + m.procesos.length, 0)
    expect(totalProcesosNivel1).toBeGreaterThan(0)

    expect(resultado.top_3_brechas_criticas.length).toBeGreaterThan(0)
    expect(resultado.recomendacion_ceo.length).toBeGreaterThan(0)
  }, 120000)
})

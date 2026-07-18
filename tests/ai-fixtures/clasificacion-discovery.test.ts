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
  }, 180000)

  it('genera un resumen ejecutivo con diagnóstico de madurez consistente', async () => {
    const resumen = await resumirDocumento(texto)

    expect(resumen.resumen_ejecutivo.length).toBeGreaterThan(50)
    expect(resumen.nivel_madurez_amo).toBeGreaterThanOrEqual(1)
    expect(resumen.nivel_madurez_amo).toBeLessThanOrEqual(5)
    expect(resumen.hallazgos_criticos.length).toBeGreaterThan(0)
    expect(resumen.riesgos_criticos.length).toBeGreaterThan(0)
  }, 180000)

  it('Process Discovery AI detecta la industria correcta y no inventa procesos ni macroprocesos', async () => {
    const resumen = await resumirDocumento(texto)
    const contexto = `Documento de prueba: ${nombre}`

    const resultado = await discoveryProcesos(contexto, [resumen.resumen_ejecutivo])

    expect(resultado.industria_detectada).toMatch(industriaEsperada)
    // Un solo documento de entrada → un solo macroproceso (el que el propio
    // documento indica), nunca varios inventados por la IA.
    expect(resultado.macroprocesos.length).toBe(1)

    const totalProcesosNivel1 = resultado.macroprocesos.reduce((acc, m) => acc + m.procesos.length, 0)
    // Un documento de entrada → exactamente un proceso, nunca "propuesta_ia".
    expect(totalProcesosNivel1).toBe(1)
    resultado.macroprocesos.forEach(m => {
      expect(m.origen).toBe('detectado')
      m.procesos.forEach(p => {
        expect(p.origen).toBe('detectado')
        expect(Array.isArray(p.puntos_mejora)).toBe(true)
      })
    })

    expect(resultado.recomendacion_ceo.length).toBeGreaterThan(0)
  }, 240000)
})

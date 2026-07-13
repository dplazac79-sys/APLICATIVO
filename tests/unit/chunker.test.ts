import { describe, it, expect } from 'vitest'
import { chunkearTexto } from '../../src/lib/ai/chunker'

describe('chunkearTexto', () => {
  it('devuelve lista vacía para texto vacío o solo espacios', () => {
    expect(chunkearTexto('')).toEqual([])
    expect(chunkearTexto('   \n  ')).toEqual([])
  })

  it('devuelve un único chunk para texto corto sin secciones', () => {
    const texto = 'Este es un texto corto sin estructura de secciones detectable.'
    const chunks = chunkearTexto(texto)
    expect(chunks).toHaveLength(1)
    expect(chunks[0].texto).toBe(texto)
    expect(chunks[0].indice).toBe(0)
    expect(chunks[0].titulo).toBeNull()
  })

  it('detecta un encabezado Markdown y arranca una nueva sección solo tras acumular contenido', () => {
    // El título de una sección se detecta al *empezar* la siguiente sección
    // con suficiente contenido acumulado (>200 chars) — por eso el texto de
    // "Introducción" queda en la primera sección (sin título propio) y el
    // título "Desarrollo" marca el inicio de la segunda.
    const texto =
      '## Introducción\n' + 'x'.repeat(250) + '\n\n## Desarrollo\n' + 'y'.repeat(250)
    const chunks = chunkearTexto(texto)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    expect(chunks[0].texto).toContain('Introducción')
    expect(chunks.some(c => c.titulo?.includes('Desarrollo'))).toBe(true)
  })

  it('asigna índices consecutivos empezando en 0', () => {
    const texto =
      '## Sección A\n' + 'a'.repeat(250) + '\n\n## Sección B\n' + 'b'.repeat(250) + '\n\n## Sección C\n' + 'c'.repeat(250)
    const chunks = chunkearTexto(texto)
    chunks.forEach((c, i) => expect(c.indice).toBe(i))
  })

  it('descarta chunks triviales de menos de 50 caracteres', () => {
    const texto = '## Sección\ncorto\n\n## Otra\n' + 'x'.repeat(300)
    const chunks = chunkearTexto(texto)
    expect(chunks.every(c => c.texto.length > 50)).toBe(true)
  })

  it('subdivide una sección muy larga en varios chunks con overlap', () => {
    const parrafoLargo = Array.from({ length: 40 }, (_, i) => `Párrafo número ${i} con contenido de relleno representativo del documento real.`).join('\n\n')
    const texto = `## Sección Extensa\n${parrafoLargo}`
    const chunks = chunkearTexto(texto)
    expect(chunks.length).toBeGreaterThan(1)
    // el overlap hace que el segundo chunk comparta texto con el final del primero
    const finalPrimero = chunks[0].texto.slice(-50)
    expect(chunks[1].texto).toContain(finalPrimero.slice(-20))
  })

  it('estima tokens de forma proporcional a la longitud del texto', () => {
    const texto = 'a'.repeat(400)
    const chunks = chunkearTexto(texto)
    expect(chunks[0].tokens_est).toBe(Math.round(400 * 0.25))
  })
})

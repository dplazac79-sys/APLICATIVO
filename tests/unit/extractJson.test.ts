import { describe, it, expect } from 'vitest'
import { extractJson } from '@/lib/ai/claude'

describe('extractJson', () => {
  it('parsea JSON plano sin envoltura', () => {
    expect(extractJson('{"a": 1, "b": "dos"}')).toEqual({ a: 1, b: 'dos' })
  })

  it('extrae JSON de un bloque markdown ```json', () => {
    const texto = '```json\n{"bloque": "estrategico"}\n```'
    expect(extractJson(texto)).toEqual({ bloque: 'estrategico' })
  })

  it('extrae JSON de un bloque markdown genérico ```', () => {
    const texto = '```\n{"x": true}\n```'
    expect(extractJson(texto)).toEqual({ x: true })
  })

  it('extrae el primer objeto JSON cuando hay texto alrededor sin markdown', () => {
    const texto = 'Aquí está el resultado:\n{"clave": "valor"}\nFin del análisis.'
    expect(extractJson(texto)).toEqual({ clave: 'valor' })
  })

  it('lanza error si el contenido no es JSON válido', () => {
    expect(() => extractJson('esto no es json')).toThrow()
  })
})

import { describe, it, expect } from 'vitest'
import { ORDEN_GENERACION, LABEL_ARTEFACTO } from '../../src/lib/artefactos-meta'
import { TEMPLATES_GARANTIZADOS } from '../../src/lib/artefactos-templates'
import type { TipoArtefacto } from '../../src/types/database'

const TODOS_LOS_TIPOS = Object.keys(LABEL_ARTEFACTO) as TipoArtefacto[]

describe('artefactos-meta / artefactos-templates — consistencia', () => {
  it('ORDEN_GENERACION no contiene tipos duplicados', () => {
    expect(new Set(ORDEN_GENERACION).size).toBe(ORDEN_GENERACION.length)
  })

  it('todo tipo en ORDEN_GENERACION tiene label y template garantizado', () => {
    for (const tipo of ORDEN_GENERACION) {
      expect(LABEL_ARTEFACTO[tipo]).toBeTruthy()
      expect(TEMPLATES_GARANTIZADOS[tipo]).toBeTruthy()
    }
  })

  it('todo TipoArtefacto tiene un template garantizado no vacío', () => {
    for (const tipo of TODOS_LOS_TIPOS) {
      expect(TEMPLATES_GARANTIZADOS[tipo]).toBeTruthy()
      expect(Object.keys(TEMPLATES_GARANTIZADOS[tipo]).length).toBeGreaterThan(0)
    }
  })

  it('LABEL_ARTEFACTO y TEMPLATES_GARANTIZADOS cubren exactamente el mismo set de tipos', () => {
    const labelKeys = Object.keys(LABEL_ARTEFACTO).sort()
    const templateKeys = Object.keys(TEMPLATES_GARANTIZADOS).sort()
    expect(templateKeys).toEqual(labelKeys)
  })
})

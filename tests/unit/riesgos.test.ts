import { describe, it, expect } from 'vitest'
import { calcularNivelRiesgo } from '../../src/lib/riesgos'

describe('calcularNivelRiesgo', () => {
  it('alta probabilidad + alto impacto = crítico', () => {
    expect(calcularNivelRiesgo('alta', 'alto')).toBe('critico')
  })

  it('alta probabilidad + medio impacto = alto', () => {
    expect(calcularNivelRiesgo('alta', 'medio')).toBe('alto')
  })

  it('alta probabilidad + bajo impacto = medio', () => {
    expect(calcularNivelRiesgo('alta', 'bajo')).toBe('medio')
  })

  it('media probabilidad + alto impacto = alto', () => {
    expect(calcularNivelRiesgo('media', 'alto')).toBe('alto')
  })

  it('media probabilidad + medio impacto = medio', () => {
    expect(calcularNivelRiesgo('media', 'medio')).toBe('medio')
  })

  it('media probabilidad + bajo impacto = bajo', () => {
    expect(calcularNivelRiesgo('media', 'bajo')).toBe('bajo')
  })

  it('baja probabilidad + alto impacto = medio', () => {
    expect(calcularNivelRiesgo('baja', 'alto')).toBe('medio')
  })

  it('baja probabilidad + medio impacto = bajo', () => {
    expect(calcularNivelRiesgo('baja', 'medio')).toBe('bajo')
  })

  it('baja probabilidad + bajo impacto = bajo', () => {
    expect(calcularNivelRiesgo('baja', 'bajo')).toBe('bajo')
  })
})

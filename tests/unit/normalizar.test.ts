import { describe, it, expect } from 'vitest'
import { titleCase, oracionCase } from '@/lib/normalizar'

describe('titleCase', () => {
  it('capitaliza cada palabra significativa', () => {
    expect(titleCase('empresa de servicios')).toBe('Empresa de Servicios')
  })

  it('mantiene en minúscula los conectores excepto la primera palabra', () => {
    expect(titleCase('el rey de la selva')).toBe('El Rey de la Selva')
  })

  it('pone en mayúsculas siglas como S.A. y LTDA.', () => {
    expect(titleCase('comercial andes s.a.')).toBe('Comercial Andes S.A.')
  })

  it('retorna string vacío sin lanzar error', () => {
    expect(titleCase('')).toBe('')
  })

  it('normaliza espacios múltiples', () => {
    expect(titleCase('empresa   de    prueba')).toBe('Empresa de Prueba')
  })
})

describe('oracionCase', () => {
  it('capitaliza solo la primera letra', () => {
    expect(oracionCase('ESTE ES UN TITULO')).toBe('Este es un titulo')
  })

  it('retorna string vacío sin lanzar error', () => {
    expect(oracionCase('')).toBe('')
  })
})

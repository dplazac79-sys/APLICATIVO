import { describe, it, expect } from 'vitest'
import { titleCase, oracionCase, formatRut, formatMiles, parseMiles } from '@/lib/normalizar'

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

describe('formatRut', () => {
  it('formatea un RUT sin puntos ni guión a formato chileno', () => {
    expect(formatRut('761234567')).toBe('76.123.456-7')
  })

  it('acepta K minúscula como dígito verificador y la normaliza a mayúscula', () => {
    expect(formatRut('12345678k')).toBe('12.345.678-K')
  })

  it('ignora caracteres no numéricos ya presentes (puntos, guión) y reformatea', () => {
    expect(formatRut('76.123.456-7')).toBe('76.123.456-7')
  })

  it('devuelve string vacío para input vacío', () => {
    expect(formatRut('')).toBe('')
  })

  it('devuelve solo el dígito verificador cuando solo hay un carácter', () => {
    expect(formatRut('7')).toBe('7')
  })
})

describe('formatMiles', () => {
  it('agrega separador de miles chileno', () => {
    expect(formatMiles('1000000')).toBe('1.000.000')
  })

  it('no agrega separador para números menores a mil', () => {
    expect(formatMiles('999')).toBe('999')
  })

  it('ignora caracteres no numéricos', () => {
    expect(formatMiles('1a2b3c')).toBe('123')
  })

  it('devuelve string vacío para input vacío o sin dígitos', () => {
    expect(formatMiles('')).toBe('')
    expect(formatMiles('abc')).toBe('')
  })
})

describe('parseMiles', () => {
  it('extrae el valor numérico de un string con puntos', () => {
    expect(parseMiles('1.000.000')).toBe(1000000)
  })

  it('devuelve null para string vacío', () => {
    expect(parseMiles('')).toBeNull()
  })

  it('parsea un número sin puntos igual', () => {
    expect(parseMiles('500')).toBe(500)
  })
})

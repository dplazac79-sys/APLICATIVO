import { describe, it, expect } from 'vitest'
import { cn } from '../../src/lib/utils'

describe('cn', () => {
  it('une clases simples', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('ignora valores falsy', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })

  it('resuelve conflictos de Tailwind quedándose con el último', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('soporta condicionales tipo objeto', () => {
    expect(cn('base', { activo: true, oculto: false })).toBe('base activo')
  })
})

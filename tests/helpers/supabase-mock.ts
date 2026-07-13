import { vi } from 'vitest'

/**
 * Query builder falso y encadenable para simular el cliente de Supabase.
 * Cada método de filtro (select/eq/in/gte/lt/order/limit) devuelve `this`
 * para soportar cadenas arbitrarias; `single()` y el `then()` propio
 * resuelven al `result` fijo con el que se construyó — el test decide el
 * resultado final, no la forma en que se llegó a él.
 */
export function fakeQuery<T>(result: T) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (v: T) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return builder
}

/**
 * Cliente admin falso: `.from(table)` despacha a `impl(table)`, que el test
 * define para devolver el `fakeQuery(...)` correspondiente a esa tabla.
 * Permite testear funciones que encadenan varias tablas (p.ej. procesos →
 * artefactos) sin acoplarse a Supabase real.
 */
export function fakeAdmin(impl: (table: string, callIndex: number) => unknown) {
  let callIndex = 0
  const from = vi.fn((table: string) => impl(table, callIndex++))
  return { from }
}

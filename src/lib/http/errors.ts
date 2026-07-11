import { NextResponse } from 'next/server'

// Respuesta de error uniforme para routes de API. Para 5xx nunca devuelve el
// mensaje crudo del error (puede traer texto de Postgres/PostgREST con
// nombres de tabla/columna/constraint — reconocimiento útil para un
// atacante); el mensaje real siempre se loguea server-side. Para 4xx el
// mensaje suele ser intencional (validación, "no encontrado") y se preserva.
export function jsonError(error: unknown, status = 500, publicMessage?: string) {
  const msg = error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error)
  console.error(`[api] ${status}:`, msg)
  return NextResponse.json(
    { error: publicMessage ?? (status >= 500 ? 'Error interno del servidor' : msg) },
    { status }
  )
}

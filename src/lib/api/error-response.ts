import { NextResponse } from 'next/server'

// Los mensajes de error de Postgres/Supabase (error.message) y de excepciones
// JS (err.message, String(err)) pueden filtrar detalles internos al cliente:
// nombres de tabla/columna, rutas de archivo, stack traces parciales. Esta
// función loguea el detalle completo en el servidor (para debugging) y
// responde al cliente un mensaje genérico y seguro — hallazgo de auditoría
// de seguridad (fuga de información).
export function errorResponse(
  err: unknown,
  status = 500,
  publicMessage = 'Ocurrió un error procesando la solicitud. Intenta de nuevo o contacta al administrador si persiste.'
) {
  const detalle = err instanceof Error ? err.message : String(err)
  console.error(`[api] Error ${status}:`, detalle)
  return NextResponse.json({ error: publicMessage }, { status })
}

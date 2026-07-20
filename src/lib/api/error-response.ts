import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

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
  // Antes esta función solo logueaba a stdout — Sentry (instalado y
  // configurado) nunca se enteraba de ningún error de la API, así que el
  // equipo solo se enteraba de una falla real si el cliente se quejaba.
  // Solo se reportan errores 5xx (falla real del servidor) — los 4xx son
  // en su mayoría validación/permisos esperados, reportarlos todos sería
  // puro ruido. Hallazgo de auditoría de observabilidad.
  if (status >= 500) {
    Sentry.captureException(err instanceof Error ? err : new Error(detalle))
  }
  return NextResponse.json({ error: publicMessage }, { status })
}

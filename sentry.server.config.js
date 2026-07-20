// @ts-nocheck
import * as Sentry from '@sentry/nextjs'

// sendDefaultPii no está activado, así que Sentry ya no adjunta cookies/IP
// por defecto — pero un mensaje de error o breadcrumb puede terminar
// incluyendo un email u otro dato personal de forma incidental (ej. un
// error de Postgres que cita el valor de una columna única). beforeSend es
// la última barrera antes de que el evento salga hacia el SaaS de Sentry.
function scrubPII(event) {
  const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const scrub = (v) => (typeof v === 'string' ? v.replace(EMAIL_RE, '[email redactado]') : v)

  if (event.message) event.message = scrub(event.message)
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = scrub(ex.value)
    }
  }
  if (event.request) {
    delete event.request.cookies
    if (event.request.headers) {
      delete event.request.headers.cookie
      delete event.request.headers.authorization
    }
  }
  return event
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  beforeSend: scrubPII,
})

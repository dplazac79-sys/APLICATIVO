import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Next.js App Router no tiene un límite de tamaño de body configurable
// globalmente (a diferencia de Pages API) — sin esto, cualquier ruta que
// haga req.json() acepta un payload arbitrariamente grande, cargado
// completo en memoria antes de que la ruta valide nada. El chequeo de
// Content-Length es una primera barrera (no cubre chunked/sin header, pero
// bloquea el caso común) — hallazgo de auditoría de seguridad.
const MAX_BODY_BYTES = 10 * 1024 * 1024 // 10MB — generoso para el JSON más grande legítimo (contenido de artefactos/documentos)

export async function middleware(request: NextRequest) {
  if (
    request.nextUrl.pathname.startsWith('/api/') &&
    ['POST', 'PUT', 'PATCH'].includes(request.method)
  ) {
    const contentLength = request.headers.get('content-length')
    if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'El cuerpo de la solicitud excede el tamaño máximo permitido.' }, { status: 413 })
    }
  }
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/admin/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

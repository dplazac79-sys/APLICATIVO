import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// CSP con nonce por request — reemplaza 'unsafe-inline'/'unsafe-eval' en
// script-src. Se genera acá (no en next.config.mjs) porque el nonce debe
// ser distinto en cada request; next.config's headers() son estáticos.
// Next.js aplica automáticamente el nonce a los scripts que inyecta para
// hidratación/RSC cuando detecta el header en este formato — no requiere
// tocar el layout mientras no haya <script> inline manuales (no los hay,
// verificado: sin dangerouslySetInnerHTML ni next/script en el repo).
function construirCspConNonce(nonce: string): string {
  return [
    "default-src 'self'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://o4511589511528448.ingest.us.sentry.io",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "img-src 'self' data: blob: https://*.supabase.co",
    "font-src 'self'",
    "frame-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "worker-src 'self' blob:",
  ].join('; ')
}

export async function updateSession(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = construirCspConNonce(nonce)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  // Toda respuesta que salga de esta función (next() o redirect()) pasa por
  // acá para llevar la CSP con nonce — un solo punto de salida evita que
  // alguna rama nueva se olvide de setear el header (bug real que tenía la
  // primera versión de este cambio: el callback setAll de abajo reasignaba
  // supabaseResponse con NextResponse.next({ request }) SIN los headers con
  // el nonce, perdiendo la CSP en cualquier request que refresque cookies).
  function conCsp<T extends NextResponse>(response: T): T {
    response.headers.set('Content-Security-Policy', csp)
    return response
  }

  let supabaseResponse = conCsp(NextResponse.next({ request: { headers: requestHeaders } }))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = conCsp(NextResponse.next({ request: { headers: requestHeaders } }))
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Rutas públicas (no requieren autenticación). Nota: todo /api/admin/* ya está
  // excluido de este middleware por el matcher en src/middleware.ts — cada route
  // bajo /api/admin/ debe verificar su propia auth (bearer secret o sesión).
  const publicPaths = ['/login', '/api/auth/login', '/auth/callback', '/auth/confirm', '/api/inngest', '/cambiar-password']
  const isPublic = publicPaths.some(p => request.nextUrl.pathname.startsWith(p))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return conCsp(NextResponse.redirect(url))
  }

  if (user) {
    const pathname = request.nextUrl.pathname

    // Forzar cambio si es primer acceso
    if (user.user_metadata?.must_change_password === true && pathname !== '/cambiar-password') {
      const url = request.nextUrl.clone()
      url.pathname = '/cambiar-password'
      return conCsp(NextResponse.redirect(url))
    }

    // Forzar cambio si la contraseña caducó (90 días)
    if (pathname !== '/cambiar-password') {
      const changedAt = user.user_metadata?.password_changed_at
      if (changedAt) {
        const days90 = 90 * 24 * 60 * 60 * 1000
        if (Date.now() - new Date(changedAt).getTime() > days90) {
          const url = request.nextUrl.clone()
          url.pathname = '/cambiar-password'
          url.searchParams.set('expired', '1')
          return conCsp(NextResponse.redirect(url))
        }
      }
    }

    if (pathname === '/') {
      const { data: usuario } = await supabase
        .from('usuario')
        .select('rol')
        .eq('id', user.id)
        .single()
      const url = request.nextUrl.clone()
      url.pathname = usuario?.rol === 'usuario_cliente' ? '/portal' : '/bienvenida'
      return conCsp(NextResponse.redirect(url))
    }
  }

  return supabaseResponse
}

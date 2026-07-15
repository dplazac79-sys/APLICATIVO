import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { validarEnvCritico } from '@/lib/env'

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
  validarEnvCritico()

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
  // /api/health: Railway (y cualquier monitor externo) le pega sin cookie
  // de sesión — sin esto, el middleware lo redirigía (307) a /login antes
  // de que el propio handler de /api/health corriera, así que el
  // healthcheck de Railway "pasaba" solo porque /login devuelve 200 al
  // seguir el redirect, sin ejecutar jamás el chequeo real de conectividad
  // a la base de datos que existe en esa ruta.
  const publicPaths = ['/login', '/api/auth/login', '/auth/callback', '/auth/confirm', '/api/inngest', '/api/health', '/cambiar-password', '/olvide-password']
  const isPublic = publicPaths.some(p => request.nextUrl.pathname.startsWith(p))

  if (!user && !isPublic) {
    // Las rutas /api/* siempre las llama fetch() esperando JSON — un
    // redirect 307 a /login se sigue automáticamente en requests no-GET
    // (el navegador preserva método y body), así que el caller terminaba
    // recibiendo un 200 con el HTML de la página de login en vez de un
    // error claro. Detectado con una cookie de sesión corrupta/expirada:
    // el PATCH de guardar un artefacto fallaba con un error de parseo JSON
    // genérico ("Unexpected token '<'") en lugar del mensaje de sesión
    // vencida que si existe para el flujo de expiración por inactividad.
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return conCsp(NextResponse.json({ error: 'No autorizado' }, { status: 401 }))
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return conCsp(NextResponse.redirect(url))
  }

  // Cierre de sesión por inactividad — ventana deslizante de 2 horas. Se
  // guarda en una cookie propia (no en la sesión de Supabase, que dura mucho
  // más) con la marca de tiempo de la última request autenticada; cada
  // request dentro de la ventana la renueva, y superarla fuerza signOut().
  const INACTIVIDAD_MS = 2 * 60 * 60 * 1000
  function conActividad<T extends NextResponse>(response: T): T {
    response.cookies.set('ultima_actividad', String(Date.now()), {
      httpOnly: true, sameSite: 'lax', path: '/', maxAge: INACTIVIDAD_MS / 1000,
    })
    return response
  }

  if (user) {
    const pathname = request.nextUrl.pathname

    const ultimaActividad = request.cookies.get('ultima_actividad')?.value
    if (ultimaActividad) {
      const ultima = parseInt(ultimaActividad, 10)
      if (!Number.isNaN(ultima) && Date.now() - ultima > INACTIVIDAD_MS) {
        await supabase.auth.signOut()
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('sesion_expirada', '1')
        const resp = conCsp(NextResponse.redirect(url))
        resp.cookies.set('ultima_actividad', '', { maxAge: 0, path: '/' })
        return resp
      }
    }

    // Forzar cambio si es primer acceso
    if (user.user_metadata?.must_change_password === true && pathname !== '/cambiar-password') {
      const url = request.nextUrl.clone()
      url.pathname = '/cambiar-password'
      return conActividad(conCsp(NextResponse.redirect(url)))
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
          return conActividad(conCsp(NextResponse.redirect(url)))
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
      return conActividad(conCsp(NextResponse.redirect(url)))
    }

    return conActividad(supabaseResponse)
  }

  return supabaseResponse
}

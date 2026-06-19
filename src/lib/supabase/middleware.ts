import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

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
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Rutas públicas (no requieren autenticación)
  const publicPaths = ['/login', '/auth/callback', '/auth/confirm', '/api/inngest']
  const isPublic = publicPaths.some(p => request.nextUrl.pathname.startsWith(p))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Enforcement MFA: si el usuario tiene MFA enrollado (nextLevel = aal2)
  // pero la sesión actual solo alcanzó AAL1, redirigir al challenge.
  // Las rutas /mfa/* están exentas para no crear un loop de redirección.
  if (user) {
    const mfaPaths = ['/mfa/enroll', '/mfa/challenge']
    const isMfaRoute = mfaPaths.some(p => request.nextUrl.pathname.startsWith(p))

    if (!isMfaRoute) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal && aal.nextLevel === 'aal2' && aal.nextLevel !== aal.currentLevel) {
        const url = request.nextUrl.clone()
        url.pathname = '/mfa/challenge'
        return NextResponse.redirect(url)
      }

      // Tras el login, los roles de cliente van a su portal dedicado en lugar del dashboard.
      const pathname = request.nextUrl.pathname
      if (pathname === '/' || pathname === '/dashboard') {
        const { data: usuario } = await supabase
          .from('usuario')
          .select('rol')
          .eq('id', user.id)
          .single()
        if (usuario?.rol === 'sponsor_cliente' || usuario?.rol === 'usuario_cliente') {
          const url = request.nextUrl.clone()
          url.pathname = '/portal'
          return NextResponse.redirect(url)
        }
      }
    }
  }

  return supabaseResponse
}

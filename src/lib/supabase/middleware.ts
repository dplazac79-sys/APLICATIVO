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
  const publicPaths = ['/login', '/auth/callback', '/auth/confirm', '/api/inngest', '/api/admin/reprocesar-documentos', '/cambiar-password']
  const isPublic = publicPaths.some(p => request.nextUrl.pathname.startsWith(p))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user) {
    const pathname = request.nextUrl.pathname

    // Si el usuario debe cambiar contraseña, redirigir antes de cualquier otra cosa
    if (user.user_metadata?.must_change_password === true && pathname !== '/cambiar-password') {
      const url = request.nextUrl.clone()
      url.pathname = '/cambiar-password'
      return NextResponse.redirect(url)
    }

    if (pathname === '/') {
      const { data: usuario } = await supabase
        .from('usuario')
        .select('rol')
        .eq('id', user.id)
        .single()
      const url = request.nextUrl.clone()
      url.pathname = usuario?.rol === 'usuario_cliente' ? '/portal' : '/bienvenida'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

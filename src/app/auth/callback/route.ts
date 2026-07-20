import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const nextParam = searchParams.get('next') ?? '/dashboard'
  // 'next' venía de un query param y se concatenaba crudo en la URL de
  // redirect — un valor como "@evil.com" o "//evil.com" cambia el host que
  // el navegador interpreta, habilitando un open redirect (phishing) tras
  // el login. Solo se acepta un path relativo que empiece con "/" simple
  // (no "//", que el navegador trata como protocol-relative a otro host).
  // Hallazgo de auditoría profunda de frontend.
  const next = /^\/(?!\/)/.test(nextParam) ? nextParam : '/dashboard'

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`)
}

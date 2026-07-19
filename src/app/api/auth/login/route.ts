import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkLoginRateLimit, getClientIp } from '@/lib/auth/rate-limit-login'

const MAX_ATTEMPTS = 3

async function getAuthUserByEmail(email: string) {
  const admin = createAdminClient()
  const { data: usuarioRow } = await admin.from('usuario').select('id').eq('email', email).single()
  if (!usuarioRow?.id) return null
  const { data } = await admin.auth.admin.getUserById(usuarioRow.id)
  return data.user
}

// POST /api/auth/login
// Login consolidado en una sola ida y vuelta al servidor: verifica bloqueo,
// autentica, actualiza el contador de intentos y resuelve el destino según
// rol — todo en el mismo request, con la búsqueda de bloqueo y la
// autenticación corriendo en paralelo (no dependen una de la otra). Antes
// esto eran 4-5 llamadas secuenciales desde el navegador; ahora es 1 request
// con las operaciones internas paralelizadas. La sesión se fija por cookies
// en la misma respuesta, así que el cliente solo necesita redirigir.
export async function POST(req: NextRequest) {
  const body = await req.json() as { email: string; password: string }
  const email = body.email?.trim().toLowerCase()
  const password = body.password
  if (!email || !password) {
    return NextResponse.json({ error: 'Correo y contraseña requeridos' }, { status: 400 })
  }

  const ip = getClientIp(req)
  const rateLimit = await checkLoginRateLimit(ip)
  if (!rateLimit.permitido) {
    return NextResponse.json({ error: rateLimit.mensaje }, { status: 429 })
  }

  const supabase = createClient()
  const admin = createAdminClient()

  const [authUser, signInResult] = await Promise.all([
    getAuthUserByEmail(email),
    supabase.auth.signInWithPassword({ email, password }),
  ])

  const meta = authUser?.user_metadata ?? {}

  if (meta.locked === true) {
    return NextResponse.json({ error: 'Tu cuenta está bloqueada por demasiados intentos fallidos. Contacta al administrador del sistema.' }, { status: 423 })
  }

  const { data: signInData, error: signInError } = signInResult

  if (signInError || !signInData.user) {
    if (authUser) {
      // RPC atómico (advisory lock + UPDATE...RETURNING en una sola
      // transacción) en vez de leer failed_attempts acá y escribirlo de
      // vuelta — ese patrón read-then-write permitía que varias requests
      // concurrentes de login fallido para la misma cuenta pisaran el
      // conteo de la otra y se saltaran el bloqueo a los 3 intentos.
      const { data: intento, error: intentoError } = await admin.rpc('registrar_intento_fallido_login', {
        p_user_id: authUser.id,
        p_max_attempts: MAX_ATTEMPTS,
      }).single()
      if (intentoError || !intento) {
        return NextResponse.json({ error: 'Credenciales incorrectas.' }, { status: 401 })
      }
      const failed = (intento as { failed_attempts: number; locked: boolean }).failed_attempts
      const locked = (intento as { failed_attempts: number; locked: boolean }).locked
      if (locked) {
        return NextResponse.json({ error: 'Tu cuenta ha sido bloqueada por demasiados intentos fallidos. Contacta al administrador.' }, { status: 423 })
      }
      const rem = Math.max(0, MAX_ATTEMPTS - failed)
      return NextResponse.json({ error: `Credenciales incorrectas.${rem > 0 ? ` Te queda${rem === 1 ? '' : 'n'} ${rem} intento${rem === 1 ? '' : 's'} antes del bloqueo.` : ''}` }, { status: 401 })
    }
    return NextResponse.json({ error: 'Las credenciales proporcionadas no corresponden a un perfil activo.' }, { status: 401 })
  }

  const user = signInData.user

  // Resetear contador de intentos — no bloqueante, no afecta el tiempo de respuesta.
  if (meta.failed_attempts || meta.locked) {
    admin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...meta, failed_attempts: 0, locked: false },
    }).catch(() => {})
  }

  if (user.user_metadata?.must_change_password === true) {
    return NextResponse.json({ redirect: '/cambiar-password' })
  }

  const { data: usuario } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
  const redirect = usuario?.rol === 'usuario_cliente' ? '/portal' : '/bienvenida'
  return NextResponse.json({ redirect })
}

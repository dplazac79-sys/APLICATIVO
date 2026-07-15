import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Mismas 5 reglas que valida el formulario de cambiar-password/page.tsx —
// acá se repiten a propósito porque el checklist visual del cliente es
// puramente informativo: un usuario podía llamar supabase.auth.updateUser
// directo (consola del navegador, curl con su propio token) y poner una
// contraseña de 1 carácter, saltándose por completo estas reglas.
function cumpleRequisitos(pwd: string): boolean {
  return pwd.length >= 8
    && /[A-Z]/.test(pwd)
    && /[a-z]/.test(pwd)
    && /[0-9]/.test(pwd)
    && /[!@#$%^&*()_\-+=\[\]{};':"\\|,.<>/?]/.test(pwd)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { password } = await req.json() as { password?: string }
  if (!password || typeof password !== 'string' || !cumpleRequisitos(password)) {
    return NextResponse.json({ error: 'La contraseña no cumple todos los requisitos de seguridad.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password,
    user_metadata: {
      ...user.user_metadata,
      must_change_password: false,
      password_changed_at: new Date().toISOString(),
    },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}

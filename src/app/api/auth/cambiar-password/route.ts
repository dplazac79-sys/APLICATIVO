import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { errorResponse } from '@/lib/api/error-response'

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

  if (error) return errorResponse(error, 400, 'No se pudo cambiar la contraseña.')

  // La tabla usuario tiene RLS habilitado sin ninguna política — por diseño
  // (solo service_role puede leerla), así que el cliente NUNCA puede
  // resolver su propio rol vía supabase.from('usuario').select() desde el
  // browser. cambiar-password/page.tsx dependía de eso para decidir a dónde
  // redirigir tras el cambio, y siempre caía en la rama "no es cliente"
  // (bug funcional, no de seguridad — se detectó durante la auditoría
  // profunda de frontend). Se devuelve el rol acá, resuelto server-side.
  const { data: usuarioRow } = await admin.from('usuario').select('rol').eq('id', user.id).single()

  return NextResponse.json({ ok: true, rol: usuarioRow?.rol ?? null })
}

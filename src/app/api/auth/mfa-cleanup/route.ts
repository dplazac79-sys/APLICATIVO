import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/auth/mfa-cleanup
// Borra todos los factores MFA del usuario autenticado usando la API de admin,
// que no exige nivel AAL2 (a diferencia del unenroll del lado del cliente).
// Necesario porque MFA fue removido de la plataforma pero cuentas antiguas
// quedaron con factores TOTP verificados que bloquean el login en AAL1.
export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: factors, error: errList } = await admin.auth.admin.mfa.listFactors({ userId: user.id })
  if (errList) return NextResponse.json({ error: errList.message }, { status: 500 })

  for (const factor of factors?.factors ?? []) {
    await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: user.id })
  }

  return NextResponse.json({ ok: true, removed: factors?.factors?.length ?? 0 })
}

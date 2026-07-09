import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_ATTEMPTS = 3

async function getUserByEmail(email: string) {
  const admin = createAdminClient()
  // Buscar en tabla usuario para obtener el ID
  const { data } = await admin
    .from('usuario')
    .select('id')
    .eq('email', email)
    .single()
  if (!data?.id) return null
  const { data: { user } } = await admin.auth.admin.getUserById(data.id)
  return user
}

// POST /api/auth/lockout
// body: { action: 'check' | 'fail' | 'reset', email: string }
export async function POST(req: NextRequest) {
  try {
    const { action, email } = await req.json() as { action: string; email: string }
    if (!email || !action) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })

    const admin = createAdminClient()
    const user = await getUserByEmail(email)
    if (!user) {
      // No revelar si el usuario existe o no
      if (action === 'check') return NextResponse.json({ locked: false, remaining: MAX_ATTEMPTS })
      return NextResponse.json({ ok: true })
    }

    const meta = user.user_metadata ?? {}

    if (action === 'check') {
      return NextResponse.json({
        locked: meta.locked === true,
        remaining: Math.max(0, MAX_ATTEMPTS - (meta.failed_attempts ?? 0)),
      })
    }

    if (action === 'fail') {
      const failed = (meta.failed_attempts ?? 0) + 1
      const locked = failed >= MAX_ATTEMPTS
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: { ...meta, failed_attempts: failed, locked },
      })
      return NextResponse.json({ locked, remaining: Math.max(0, MAX_ATTEMPTS - failed) })
    }

    if (action === 'reset') {
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: { ...meta, failed_attempts: 0, locked: false },
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

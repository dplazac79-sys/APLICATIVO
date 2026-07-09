import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// PATCH /api/auth/desbloquear  body: { userId: string }
export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: yo } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
  if (yo?.rol !== 'super_admin') return NextResponse.json({ error: 'Solo super_admin' }, { status: 403 })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { data: { user: target } } = await admin.auth.admin.getUserById(userId)
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  await admin.auth.admin.updateUserById(userId, {
    user_metadata: { ...target.user_metadata, locked: false, failed_attempts: 0 },
  })

  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/auth/mfa-cleanup
// Limpieza única: borra los factores MFA de TODOS los usuarios del sistema.
// MFA fue removido de la plataforma por decisión de producto — este endpoint
// se ejecuta una sola vez para desenrolar cuentas que quedaron con factores
// TOTP verificados de la implementación anterior. Solo super_admin.
export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: yo } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
  if (yo?.rol !== 'super_admin') return NextResponse.json({ error: 'Solo super_admin' }, { status: 403 })

  const admin = createAdminClient()
  const { data: { users }, error: errUsers } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (errUsers) return NextResponse.json({ error: errUsers.message }, { status: 500 })

  let totalRemovido = 0
  const resultados: Array<{ email: string; removidos: number }> = []

  for (const u of users) {
    const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId: u.id })
    const lista = factors?.factors ?? []
    for (const factor of lista) {
      await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: u.id })
    }
    if (lista.length > 0) {
      totalRemovido += lista.length
      resultados.push({ email: u.email ?? u.id, removidos: lista.length })
    }
  }

  return NextResponse.json({ ok: true, usuariosAfectados: resultados.length, factoresRemovidos: totalRemovido, detalle: resultados })
}

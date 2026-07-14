import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/http/errors'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/tenant'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  if (!(await requireRole(user.id, ['super_admin']))) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const body = await req.json()
  const admin = createAdminClient()

  const { error } = await admin
    .from('proyecto')
    .update({
      contexto: body.contexto,
      objetivos: body.objetivos,
      alcance_incluye: body.alcance_incluye,
      alcance_excluye: body.alcance_excluye,
      n_procesos_estimados: body.n_procesos_estimados,
      fecha_inicio: body.fecha_inicio,
      fecha_estimada_cierre: body.fecha_estimada_cierre,
    })
    .eq('id', params.id)

  if (error) return jsonError(error)
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: yo } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
  if (!['super_admin', 'director_proyecto', 'consultor'].includes(yo?.rol ?? '')) {
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
    })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

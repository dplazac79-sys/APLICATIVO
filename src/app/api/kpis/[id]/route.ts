import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
  if (!usuario || !['super_admin', 'director_proyecto', 'consultor'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'Sin permisos para editar KPIs' }, { status: 403 })
  }

  const admin = createAdminClient()
  const body = await req.json()

  // Si se actualiza valor_actual, agregar al historico
  const updates: Record<string, unknown> = { ...body }
  if (body.valor_actual !== undefined) {
    const { data: kpiActual } = await admin.from('kpi').select('historico').eq('id', params.id).single()
    const historico = (kpiActual?.historico as Array<{fecha: string; valor: string}>) ?? []
    historico.push({ fecha: new Date().toISOString(), valor: String(body.valor_actual) })
    updates.historico = historico
  }

  const { data, error } = await admin.from('kpi').update(updates).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await registrarAudit({ accion: 'UPDATE', entidad: 'kpi', entidad_id: params.id, detalle: body })
  return NextResponse.json({ ok: true, kpi: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
  if (!usuario || !['super_admin', 'director_proyecto', 'consultor'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'Sin permisos para eliminar KPIs' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('kpi').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { assertProyectoAccess } from '@/lib/auth/tenant'

// Campos editables por PATCH — excluye explícitamente id/proyecto_id/creado_por
// para evitar mass-assignment (el payload completo se pasaba directo a .update()).
const CAMPOS_EDITABLES_KPI = [
  'nombre', 'descripcion', 'formula', 'linea_base', 'meta', 'valor_actual', 'frecuencia', 'dueno',
] as const

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

  const { data: kpiActual } = await admin.from('kpi').select('historico, proyecto_id').eq('id', params.id).single()
  if (!kpiActual) return NextResponse.json({ error: 'KPI no encontrado' }, { status: 404 })
  if (!(await assertProyectoAccess(user.id, kpiActual.proyecto_id))) {
    return NextResponse.json({ error: 'Sin acceso a este KPI' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {}
  for (const campo of CAMPOS_EDITABLES_KPI) {
    if (campo in body) updates[campo] = body[campo]
  }

  // Si se actualiza valor_actual, agregar al historico
  if (body.valor_actual !== undefined) {
    const historico = (kpiActual.historico as Array<{fecha: string; valor: string}>) ?? []
    historico.push({ fecha: new Date().toISOString(), valor: String(body.valor_actual) })
    updates.historico = historico
  }

  const { data, error } = await admin.from('kpi').update(updates).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await registrarAudit({ accion: 'UPDATE', entidad: 'kpi', entidad_id: params.id, detalle: updates })
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
  const { data: kpi } = await admin.from('kpi').select('proyecto_id').eq('id', params.id).single()
  if (!kpi) return NextResponse.json({ error: 'KPI no encontrado' }, { status: 404 })
  if (!(await assertProyectoAccess(user.id, kpi.proyecto_id))) {
    return NextResponse.json({ error: 'Sin acceso a este KPI' }, { status: 403 })
  }

  const { error } = await admin.from('kpi').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

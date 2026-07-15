import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/http/errors'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { calcularNivelRiesgo } from '@/lib/riesgos'
import { assertProyectoAccess, requireRole } from '@/lib/auth/tenant'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!(await requireRole(user.id, ['super_admin', 'director_proyecto', 'consultor']))) {
    return NextResponse.json({ error: 'Sin permisos para editar riesgos' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: riesgoActual } = await admin.from('riesgo').select('proyecto_id').eq('id', params.id).single()
  if (!riesgoActual) return NextResponse.json({ error: 'Riesgo no encontrado' }, { status: 404 })
  if (!(await assertProyectoAccess(user.id, riesgoActual.proyecto_id as string))) {
    return NextResponse.json({ error: 'Sin acceso a este riesgo' }, { status: 403 })
  }

  const body = await req.json()

  // Whitelist de campos editables
  const updates: Record<string, unknown> = {}
  if (body.descripcion !== undefined) updates.descripcion = body.descripcion
  if (body.control !== undefined) updates.control = body.control
  if (body.probabilidad !== undefined) updates.probabilidad = body.probabilidad
  if (body.impacto !== undefined) updates.impacto = body.impacto

  // Recalcular nivel_riesgo si cambian probabilidad o impacto
  if (body.probabilidad || body.impacto) {
    const { data: actual } = await admin.from('riesgo').select('probabilidad, impacto').eq('id', params.id).single()
    const prob = (body.probabilidad ?? actual?.probabilidad ?? 'media') as import('@/lib/riesgos').Probabilidad
    const imp = (body.impacto ?? actual?.impacto ?? 'medio') as import('@/lib/riesgos').Impacto
    updates.nivel_riesgo = calcularNivelRiesgo(prob, imp)
  }

  const { data, error } = await admin.from('riesgo').update(updates).eq('id', params.id).select().single()
  if (error) return jsonError(error)
  await registrarAudit({ accion: 'UPDATE', entidad: 'riesgo', entidad_id: params.id, detalle: updates })
  return NextResponse.json({ ok: true, riesgo: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!(await requireRole(user.id, ['super_admin', 'director_proyecto', 'consultor']))) {
    return NextResponse.json({ error: 'Sin permisos para eliminar riesgos' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: riesgoActual } = await admin.from('riesgo').select('proyecto_id').eq('id', params.id).single()
  if (!riesgoActual) return NextResponse.json({ error: 'Riesgo no encontrado' }, { status: 404 })
  if (!(await assertProyectoAccess(user.id, riesgoActual.proyecto_id as string))) {
    return NextResponse.json({ error: 'Sin acceso a este riesgo' }, { status: 403 })
  }

  const { error } = await admin.from('riesgo').delete().eq('id', params.id)
  if (error) return jsonError(error)
  return NextResponse.json({ ok: true })
}

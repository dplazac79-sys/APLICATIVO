import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { assertProyectoAccess } from '@/lib/auth/tenant'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
  if (!usuario || !['super_admin', 'director_proyecto', 'consultor'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: recActual } = await admin.from('kg_recomendacion').select('proyecto_id').eq('id', params.id).single()
  if (!recActual) return NextResponse.json({ error: 'Recomendación no encontrada' }, { status: 404 })
  if (!(await assertProyectoAccess(user.id, recActual.proyecto_id))) {
    return NextResponse.json({ error: 'Sin acceso a esta recomendación' }, { status: 403 })
  }

  const body = await req.json()
  const { estado, roadmap_id, score_impacto, score_esfuerzo } = body

  const estadosValidos = ['sugerida', 'aprobada', 'descartada']
  if (estado && !estadosValidos.includes(estado)) {
    return NextResponse.json({ error: `estado debe ser: ${estadosValidos.join(', ')}` }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (estado !== undefined) updates.estado = estado
  if (roadmap_id !== undefined) updates.roadmap_id = roadmap_id
  if (score_impacto !== undefined) updates.score_impacto = score_impacto
  if (score_esfuerzo !== undefined) updates.score_esfuerzo = score_esfuerzo

  const { data, error } = await admin
    .from('kg_recomendacion')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await registrarAudit({
    accion: 'UPDATE',
    entidad: 'kg_recomendacion',
    entidad_id: params.id,
    detalle: updates,
  })

  return NextResponse.json({ ok: true, recomendacion: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
  if (!['super_admin', 'director_proyecto', 'consultor'].includes(usuario?.rol ?? '')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: rec } = await admin.from('kg_recomendacion').select('proyecto_id').eq('id', params.id).single()
  if (!rec) return NextResponse.json({ error: 'Recomendación no encontrada' }, { status: 404 })
  if (!(await assertProyectoAccess(user.id, rec.proyecto_id))) {
    return NextResponse.json({ error: 'Sin acceso a esta recomendación' }, { status: 403 })
  }

  const { error } = await admin.from('kg_recomendacion').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

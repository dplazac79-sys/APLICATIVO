import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'

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

  const admin = createAdminClient()
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
  const { error } = await admin.from('kg_recomendacion').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

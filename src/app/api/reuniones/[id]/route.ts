import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { assertProyectoAccess } from '@/lib/auth/tenant'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
  if (!usuario || !['super_admin', 'director_proyecto', 'consultor'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'Sin permisos para editar reuniones' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: reunionActual } = await admin.from('reunion').select('proyecto_id').eq('id', params.id).single()
  if (!reunionActual) return NextResponse.json({ error: 'Reunión no encontrada' }, { status: 404 })
  if (!(await assertProyectoAccess(user.id, reunionActual.proyecto_id))) {
    return NextResponse.json({ error: 'Sin acceso a esta reunión' }, { status: 403 })
  }

  const body = await req.json()
  const payload: Record<string, unknown> = {}
  if (body.titulo !== undefined) payload.titulo = body.titulo
  if (body.fecha !== undefined) payload.fecha = body.fecha
  if (body.participantes !== undefined) payload.participantes = body.participantes
  if (body.acuerdos !== undefined) payload.acuerdos = body.acuerdos
  const { data, error } = await admin.from('reunion').update(payload).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await registrarAudit({ accion: 'UPDATE', entidad: 'reunion', entidad_id: params.id, detalle: body })
  return NextResponse.json({ ok: true, reunion: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
  if (!usuario || !['super_admin', 'director_proyecto', 'consultor'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'Sin permisos para eliminar reuniones' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: reunion } = await admin.from('reunion').select('proyecto_id').eq('id', params.id).single()
  if (!reunion) return NextResponse.json({ error: 'Reunión no encontrada' }, { status: 404 })
  if (!(await assertProyectoAccess(user.id, reunion.proyecto_id))) {
    return NextResponse.json({ error: 'Sin acceso a esta reunión' }, { status: 403 })
  }

  const { error } = await admin.from('reunion').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

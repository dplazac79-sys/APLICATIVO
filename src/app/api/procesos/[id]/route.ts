import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const admin = createAdminClient()
    const { data: usuario } = await admin.from('usuario').select('rol').eq('id', user.id).single()
    const rolesAutorizados = ['super_admin', 'director_proyecto', 'consultor']
    if (!usuario || !rolesAutorizados.includes(usuario.rol)) {
      return NextResponse.json({ error: 'Sin permisos para editar procesos' }, { status: 403 })
    }

    const body = await req.json()
    const updates: Record<string, unknown> = {}
    if (typeof body.nombre === 'string' && body.nombre.trim()) updates.nombre = body.nombre.trim()
    if (typeof body.descripcion === 'string') updates.descripcion = body.descripcion.trim() || null
    if (typeof body.estado_oferta === 'string' && ['propuesto', 'aceptado', 'rechazado'].includes(body.estado_oferta)) {
      updates.estado_oferta = body.estado_oferta
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('proceso')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await registrarAudit({
      accion: 'UPDATE',
      entidad: 'proceso',
      entidad_id: params.id,
      detalle: updates,
    })

    return NextResponse.json({ ok: true, proceso: data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

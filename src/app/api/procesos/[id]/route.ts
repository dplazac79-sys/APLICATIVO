import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/http/errors'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { assertProyectoAccess } from '@/lib/auth/tenant'

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

    const { data: procesoActual } = await admin.from('proceso').select('proyecto_id').eq('id', params.id).single()
    if (!procesoActual) return NextResponse.json({ error: 'Proceso no encontrado' }, { status: 404 })
    if (!(await assertProyectoAccess(user.id, procesoActual.proyecto_id as string))) {
      return NextResponse.json({ error: 'Sin acceso a este proceso' }, { status: 403 })
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

    if (error) return jsonError(error)

    await registrarAudit({ accion: 'UPDATE', entidad: 'proceso', entidad_id: params.id, detalle: updates })

    // Registrar en historial de versiones
    const descripcionCambio = updates.estado_oferta
      ? `Proceso marcado como ${updates.estado_oferta === 'aceptado' ? 'aceptado para implementación' : updates.estado_oferta}`
      : updates.nombre ? `Nombre actualizado: "${updates.nombre}"` : 'Descripción del proceso actualizada'

    await admin.from('proceso_historial').insert({
      proceso_id: params.id,
      proyecto_id: data.proyecto_id,
      version: 1,
      tipo_cambio: updates.estado_oferta ? 'estado_oferta' : 'edicion_manual',
      descripcion: descripcionCambio,
      detalle: updates,
      modificado_por: user.id,
    }).then(() => null, () => null) // no bloquear si tabla no existe aún

    return NextResponse.json({ ok: true, proceso: data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

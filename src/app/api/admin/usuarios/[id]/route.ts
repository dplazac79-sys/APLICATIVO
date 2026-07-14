import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { jsonError } from '@/lib/http/errors'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: yo } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
  if (yo?.rol !== 'super_admin') return NextResponse.json({ error: 'Solo super_admin puede eliminar usuarios' }, { status: 403 })

  if (params.id === user.id) {
    return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: objetivo } = await admin.from('usuario').select('id, nombre, email, rol').eq('id', params.id).single()
  if (!objetivo) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  // audit_log.usuario_id no tiene ON DELETE CASCADE — se limpia a null en vez de
  // borrar las filas, para conservar el historial de auditoría de lo que esa
  // persona hizo mientras tuvo la cuenta activa.
  await admin.from('audit_log').update({ usuario_id: null }).eq('usuario_id', params.id)
  await admin.from('usuario_proyecto').delete().eq('usuario_id', params.id)
  await admin.from('usuario').delete().eq('id', params.id)

  const { error: errAuth } = await admin.auth.admin.deleteUser(params.id)
  if (errAuth) return jsonError(errAuth, 500, 'El usuario se eliminó de la base de datos pero falló al eliminar el acceso de autenticación — contacta a soporte.')

  await registrarAudit({
    accion: 'DELETE',
    entidad: 'usuario',
    entidad_id: params.id,
    detalle: { nombre: objetivo.nombre, email: objetivo.email, rol: objetivo.rol },
    usuarioId: user.id,
  })

  return NextResponse.json({ ok: true })
}

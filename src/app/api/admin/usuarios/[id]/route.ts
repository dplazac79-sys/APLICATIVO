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

  // No permitir eliminar al último super_admin del sistema — dejaría la
  // plataforma sin nadie capaz de administrar usuarios/desbloquear cuentas.
  if (objetivo.rol === 'super_admin') {
    const { count } = await admin.from('usuario').select('id', { count: 'exact', head: true }).eq('rol', 'super_admin')
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: 'No puedes eliminar al último super_admin del sistema' }, { status: 400 })
    }
  }

  // Se revoca el acceso de autenticación primero: si esto falla, no se toca
  // la base de datos y el usuario queda exactamente como estaba (nada
  // inconsistente). Si en cambio se borrara primero la fila de BD y luego
  // fallara este paso, quedaría una identidad de Auth "viva" con la que
  // alguien podría seguir iniciando sesión sin tener fila de usuario.
  const { error: errAuth } = await admin.auth.admin.deleteUser(params.id)
  if (errAuth) return jsonError(errAuth, 500, 'No se pudo revocar el acceso del usuario — no se eliminó nada. Intenta de nuevo.')

  // audit_log.usuario_id no tiene ON DELETE CASCADE — se limpia a null en vez de
  // borrar las filas, para conservar el historial de auditoría de lo que esa
  // persona hizo mientras tuvo la cuenta activa.
  await admin.from('audit_log').update({ usuario_id: null }).eq('usuario_id', params.id)
  await admin.from('usuario_proyecto').delete().eq('usuario_id', params.id)
  const { error: errUsuario } = await admin.from('usuario').delete().eq('id', params.id)
  if (errUsuario) return jsonError(errUsuario, 500, 'El acceso del usuario ya fue revocado, pero falló limpiar su registro — contacta a soporte.')

  await registrarAudit({
    accion: 'DELETE',
    entidad: 'usuario',
    entidad_id: params.id,
    detalle: { nombre: objetivo.nombre, email: objetivo.email, rol: objetivo.rol },
    usuarioId: user.id,
  })

  return NextResponse.json({ ok: true })
}

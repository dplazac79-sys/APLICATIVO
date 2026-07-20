import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/http/errors'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { assertProyectoAccess, requireRole, getRolUsuario } from '@/lib/auth/tenant'
import { errorResponse } from '@/lib/api/error-response'

// usuario_cliente es de solo lectura sobre documentos — la política RLS
// document_update (migración 039) ya restringe la escritura a estos roles,
// pero esta ruta usa el cliente admin (bypasea RLS), así que necesita su
// propio chequeo explícito en vez de depender de que RLS lo haga por ella.
const ROLES_ELIMINAN = ['super_admin', 'director_proyecto', 'consultor', 'sponsor_cliente']

// GET: cuántos procesos se originaron desde este documento — antes de
// migración 039/041 eliminar un documento origen no avisaba nada; el
// proceso quedaba con documento_origen_id en null (ON DELETE SET NULL) y
// se perdía la trazabilidad de origen sin que nadie lo notara.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: doc } = await admin.from('documento').select('proyecto_id').eq('id', params.id).single()
  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
  if (!(await assertProyectoAccess(user.id, doc.proyecto_id))) {
    return NextResponse.json({ error: 'Sin acceso a este documento' }, { status: 403 })
  }

  const { count } = await admin
    .from('proceso')
    .select('id', { count: 'exact', head: true })
    .eq('documento_origen_id', params.id)

  return NextResponse.json({ procesos_vinculados: count ?? 0 })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  if (!(await requireRole(user.id, ROLES_ELIMINAN))) {
    return NextResponse.json({ error: 'Sin permisos para eliminar documentos' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Obtener el documento para saber el storage path
  const { data: doc, error: errDoc } = await admin.from('documento').select('url_storage, proyecto_id, subido_por').eq('id', params.id).single()
  if (errDoc || !doc) return errorResponse(errDoc ?? new Error('not found'), 404, 'Documento no encontrado')

  if (!(await assertProyectoAccess(user.id, doc.proyecto_id))) {
    return NextResponse.json({ error: 'Sin acceso a este documento' }, { status: 403 })
  }

  // El botón de borrar ya se ocultaba en la UI para sponsor_cliente cuando el
  // documento lo subió alguien del equipo interno, pero esta ruta no
  // replicaba esa restricción — un sponsor_cliente podía borrar vía API
  // directa un documento subido por su consultor/director. Hallazgo de
  // auditoría profunda de frontend (UI más estricta que la API).
  const rolActor = await getRolUsuario(user.id)
  if (rolActor === 'sponsor_cliente' && doc.subido_por) {
    const rolSubidoPor = await getRolUsuario(doc.subido_por)
    if (rolSubidoPor && ['super_admin', 'director_proyecto', 'consultor'].includes(rolSubidoPor)) {
      return NextResponse.json({ error: 'No puedes eliminar documentos subidos por el equipo consultor' }, { status: 403 })
    }
  }

  // Eliminar del storage
  if (doc.url_storage) {
    const { error: errStorage } = await admin.storage.from('documentos').remove([doc.url_storage])
    if (errStorage) {
      console.error(`[documentos/delete] Falló borrar storage para documento_id=${params.id}, path=${doc.url_storage}:`, errStorage.message)
    }
  }

  // Eliminar de la BD
  const { error } = await admin.from('documento').delete().eq('id', params.id)
  if (error) return jsonError(error)

  await registrarAudit({
    accion: 'DELETE',
    entidad: 'documento',
    entidad_id: params.id,
    detalle: { url_storage: doc.url_storage },
  })

  return NextResponse.json({ ok: true })
}

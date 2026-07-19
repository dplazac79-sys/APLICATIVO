import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { assertProyectoAccess } from '@/lib/auth/tenant'
import { ROLES_EDITAN_ARTEFACTO } from '@/lib/artefactos-estado'
import { errorResponse } from '@/lib/api/error-response'

// POST: valida en un solo paso todos los artefactos "pendiente" de un
// proceso (pendiente → validado). Misma transición que ya permite el PATCH
// individual para cualquier rol con permiso de edición (incluye
// sponsor_cliente) — esto solo la aplica a todos los pendientes de una vez,
// para no obligar a un clic por artefacto cuando el cliente ya revisó todo.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: usuario } = await admin.from('usuario').select('rol').eq('id', user.id).single()
  if (!usuario || !ROLES_EDITAN_ARTEFACTO.includes(usuario.rol)) {
    return NextResponse.json({ error: 'Sin permisos para validar artefactos' }, { status: 403 })
  }

  const { data: proceso } = await admin.from('proceso').select('proyecto_id').eq('id', params.id).single()
  if (!proceso) return NextResponse.json({ error: 'Proceso no encontrado' }, { status: 404 })

  if (!(await assertProyectoAccess(user.id, proceso.proyecto_id))) {
    return NextResponse.json({ error: 'Sin acceso a este proceso' }, { status: 403 })
  }

  const { data: actualizados, error } = await admin
    .from('artefacto')
    .update({ estado_validacion: 'validado' })
    .eq('proceso_id', params.id)
    .eq('estado_validacion', 'pendiente')
    .select('id, tipo')

  if (error) return errorResponse(error, 500, 'No se pudieron validar los artefactos.')

  if (actualizados && actualizados.length > 0) {
    await registrarAudit({
      accion: 'UPDATE',
      entidad: 'artefacto',
      entidad_id: params.id,
      detalle: {
        accion_masiva: 'validar_todos',
        proceso_id: params.id,
        tipos: actualizados.map(a => a.tipo),
        cantidad: actualizados.length,
      },
    })
  }

  return NextResponse.json({ ok: true, actualizados: actualizados?.length ?? 0 })
}

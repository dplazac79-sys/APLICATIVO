import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { requireRole } from '@/lib/auth/tenant'

// DELETE: quita a un usuario del equipo de un proyecto (no elimina la cuenta,
// solo su membresía usuario_proyecto) — necesario para limpiar cuentas de
// prueba de un proyecto antes de entregarlo a un cliente real, sin tener que
// borrar la cuenta completa si se usa en otros proyectos.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  if (!(await requireRole(user.id, ['super_admin']))) {
    return NextResponse.json({ error: 'Solo super_admin puede gestionar el equipo de un proyecto' }, { status: 403 })
  }

  const { usuario_id } = await req.json() as { usuario_id?: string }
  if (!usuario_id) return NextResponse.json({ error: 'Falta usuario_id' }, { status: 400 })

  const admin = createAdminClient()
  const { data: existente } = await admin
    .from('usuario_proyecto')
    .select('usuario_id')
    .eq('proyecto_id', params.id)
    .eq('usuario_id', usuario_id)
    .maybeSingle()

  if (!existente) return NextResponse.json({ error: 'Esa persona no pertenece a este proyecto' }, { status: 404 })

  const { error } = await admin
    .from('usuario_proyecto')
    .delete()
    .eq('proyecto_id', params.id)
    .eq('usuario_id', usuario_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await registrarAudit({
    accion: 'DELETE',
    entidad: 'usuario_proyecto',
    entidad_id: `${params.id}:${usuario_id}`,
    detalle: { proyecto_id: params.id, usuario_id },
  })

  return NextResponse.json({ ok: true })
}

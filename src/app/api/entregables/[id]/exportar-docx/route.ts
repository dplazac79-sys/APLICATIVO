import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { generarEntregableDocx } from '@/lib/exportar/generarDocx'
import { requireRole } from '@/lib/auth/tenant'
import { errorResponse } from '@/lib/api/error-response'

export const runtime = 'nodejs'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        if (!(await requireRole(user.id, ['super_admin', 'director_proyecto', 'consultor', 'sponsor_cliente']))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data: entregable, error } = await admin
      .from('entregable')
      .select('id, nombre, tipo, contenido, proyecto:proyecto_id (nombre, cliente:cliente_id (razon_social))')
      .eq('id', params.id)
      .single()

    if (error || !entregable) return NextResponse.json({ error: 'Entregable no encontrado' }, { status: 404 })

    const { data: visible } = await supabase.from('entregable').select('id').eq('id', params.id).maybeSingle()
    if (!visible) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

    const proyecto = entregable.proyecto as unknown as { nombre: string; cliente: { razon_social: string } | null } | null
    const proyectoNombre = proyecto?.cliente?.razon_social
      ? `${proyecto.cliente.razon_social} — ${proyecto.nombre}`
      : proyecto?.nombre ?? 'Proyecto'

    const docx = await generarEntregableDocx({
      nombre: entregable.nombre,
      tipo: entregable.tipo,
      proyecto: proyectoNombre,
      fecha: new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }),
      contenido: (entregable.contenido ?? {}) as Record<string, unknown>,
    })

    await registrarAudit({
      accion: 'EXPORT',
      entidad: 'entregable',
      entidad_id: entregable.id,
      detalle: { formato: 'docx', tipo: entregable.tipo },
      usuarioId: user.id,
    })

    const filename = entregable.nombre.replace(/[^\w\s.-]/g, '').trim().slice(0, 80) || 'entregable'

    return new Response(new Uint8Array(docx), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}.docx"`,
        'Content-Length': String(docx.length),
      },
    })
  } catch (err) {
    return errorResponse(err, 500, 'No se pudo generar el documento DOCX.')
  }
}

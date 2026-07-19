import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { generarEntregablePdf } from '@/lib/pdf/generarPdf'
import { errorResponse } from '@/lib/api/error-response'

export const runtime = 'nodejs'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: usuario } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
    if (
      !usuario ||
      !['super_admin', 'director_proyecto', 'consultor', 'sponsor_cliente'].includes(usuario.rol)
    ) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const admin = createAdminClient()

    // Carga del entregable con su proyecto y cliente
    const { data: entregable, error } = await admin
      .from('entregable')
      .select('id, nombre, tipo, contenido, proyecto:proyecto_id (nombre, cliente:cliente_id (razon_social))')
      .eq('id', params.id)
      .single()

    if (error || !entregable) {
      return NextResponse.json({ error: 'Entregable no encontrado' }, { status: 404 })
    }

    // RLS check manual: verificar que el usuario pueda ver este entregable (RLS aplica al client normal)
    const { data: visible } = await supabase.from('entregable').select('id').eq('id', params.id).maybeSingle()
    if (!visible) return NextResponse.json({ error: 'Sin acceso a este entregable' }, { status: 403 })

    const proyecto = entregable.proyecto as unknown as
      | { nombre: string; cliente: { razon_social: string } | null }
      | null

    const proyectoNombre = proyecto?.cliente?.razon_social
      ? `${proyecto.cliente.razon_social} — ${proyecto.nombre}`
      : proyecto?.nombre ?? 'Proyecto'

    const pdf = await generarEntregablePdf({
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
      detalle: { formato: 'pdf', tipo: entregable.tipo },
      usuarioId: user.id,
    })

    const filename = entregable.nombre.replace(/[^\w\s.-]/g, '').trim().slice(0, 80) || 'entregable'

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}.pdf"`,
        'Content-Length': String(pdf.length),
      },
    })
  } catch (err) {
    return errorResponse(err, 500, 'No se pudo generar el documento PDF.')
  }
}

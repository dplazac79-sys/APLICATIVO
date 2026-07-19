import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/http/errors'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { errorResponse } from '@/lib/api/error-response'

// GET: artefacto completo (solo publicado), bajo RLS del cliente
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data, error } = await supabase
      .from('artefacto')
      .select('id, tipo, contenido, estado_validacion, proyecto_id, updated_at')
      .eq('id', params.id)
      .eq('estado_validacion', 'publicado')
      .maybeSingle()

    if (error) return jsonError(error)
    if (!data) return NextResponse.json({ error: 'Documento no disponible' }, { status: 404 })

    return NextResponse.json({ artefacto: data })
  } catch (err) {
    return errorResponse(err, 500)
  }
}

// POST: el cliente aprueba el artefacto — notifica al equipo + audit APPROVE
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: usuario } = await supabase.from('usuario').select('nombre, rol').eq('id', user.id).single()
    if (!usuario || !['sponsor_cliente', 'usuario_cliente'].includes(usuario.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    // Bajo RLS: el cliente solo puede leer artefactos publicados de sus proyectos
    const { data: artefacto } = await supabase
      .from('artefacto')
      .select('id, tipo, proyecto_id, proceso_id')
      .eq('id', params.id)
      .eq('estado_validacion', 'publicado')
      .maybeSingle()

    if (!artefacto) return NextResponse.json({ error: 'Documento no disponible' }, { status: 404 })

    const admin = createAdminClient()

    const ARTEFACTO_LABEL: Record<string, string> = {
      as_is: 'Mapa del proceso actual',
      to_be: 'Proceso optimizado propuesto',
      raci: 'Matriz de responsabilidades',
      kpi_sla: 'Indicadores y niveles de servicio',
      dashboard_brechas: 'Análisis de brechas',
      bpmn: 'Diagrama del proceso',
    }
    const nombreDoc = ARTEFACTO_LABEL[artefacto.tipo] ?? artefacto.tipo

    // Consultores/directores del proyecto (RLS impide al cliente insertar notif a terceros → admin)
    const { data: equipo } = await admin
      .from('usuario_proyecto')
      .select('usuario_id, rol_override, usuario:usuario_id (rol)')
      .eq('proyecto_id', artefacto.proyecto_id)

    const destinatarios = (equipo ?? []).filter((m) => {
      const rol = m.rol_override ?? (m.usuario as unknown as { rol: string } | null)?.rol
      return rol === 'consultor' || rol === 'director_proyecto'
    })

    if (destinatarios.length > 0) {
      await admin.from('notificacion').insert(
        destinatarios.map((m) => ({
          usuario_id: m.usuario_id,
          proyecto_id: artefacto.proyecto_id,
          proceso_id: artefacto.proceso_id,
          tipo: 'aprobacion',
          titulo: `Cliente aprobó ${nombreDoc}`,
          cuerpo: `${usuario.nombre} aprobó el documento "${nombreDoc}".`,
        }))
      )
    }

    await registrarAudit({
      accion: 'APPROVE',
      entidad: 'artefacto',
      entidad_id: artefacto.id,
      detalle: { origen: 'portal_cliente', tipo: artefacto.tipo, aprobado_por: usuario.nombre },
      usuarioId: user.id,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err, 500)
  }
}

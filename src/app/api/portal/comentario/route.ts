import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/http/errors'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { errorResponse } from '@/lib/api/error-response'

const ARTEFACTO_LABEL: Record<string, string> = {
  as_is: 'Mapa del proceso actual',
  to_be: 'Proceso optimizado propuesto',
  raci: 'Matriz de responsabilidades',
  kpi_sla: 'Indicadores y niveles de servicio',
  dashboard_brechas: 'Análisis de brechas',
  bpmn: 'Diagrama del proceso',
}

// POST: el cliente deja un comentario sobre un artefacto → notifica a los consultores
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: usuario } = await supabase.from('usuario').select('nombre, rol').eq('id', user.id).single()
    if (!usuario || !['sponsor_cliente', 'usuario_cliente'].includes(usuario.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await req.json()
    const { artefacto_id, texto } = body as { artefacto_id?: string; texto?: string }
    if (!artefacto_id || !texto?.trim()) {
      return NextResponse.json({ error: 'Falta artefacto_id o texto' }, { status: 400 })
    }

    // Bajo RLS: validar que el cliente puede ver el artefacto publicado
    const { data: artefacto } = await supabase
      .from('artefacto')
      .select('id, tipo, proyecto_id, proceso_id')
      .eq('id', artefacto_id)
      .eq('estado_validacion', 'publicado')
      .maybeSingle()

    if (!artefacto) return NextResponse.json({ error: 'Documento no disponible' }, { status: 404 })

    const nombreDoc = ARTEFACTO_LABEL[artefacto.tipo] ?? artefacto.tipo
    const admin = createAdminClient()

    const { data: equipo } = await admin
      .from('usuario_proyecto')
      .select('usuario_id, rol_override, usuario:usuario_id (rol)')
      .eq('proyecto_id', artefacto.proyecto_id)

    const destinatarios = (equipo ?? []).filter((m) => {
      const rol = m.rol_override ?? (m.usuario as unknown as { rol: string } | null)?.rol
      return rol === 'consultor' || rol === 'director_proyecto'
    })

    if (destinatarios.length === 0) {
      return NextResponse.json({ ok: true, notificados: 0 })
    }

    const { error } = await admin.from('notificacion').insert(
      destinatarios.map((m) => ({
        usuario_id: m.usuario_id,
        proyecto_id: artefacto.proyecto_id,
        proceso_id: artefacto.proceso_id,
        tipo: 'comentario_cliente',
        titulo: `Comentario de cliente en ${nombreDoc}`,
        cuerpo: texto.trim(),
      }))
    )

    if (error) return jsonError(error)

    await registrarAudit({
      accion: 'CREATE',
      entidad: 'comentario_cliente',
      entidad_id: artefacto.id,
      detalle: { tipo: artefacto.tipo, autor: usuario.nombre },
      usuarioId: user.id,
    })

    return NextResponse.json({ ok: true, notificados: destinatarios.length })
  } catch (err) {
    return errorResponse(err, 500)
  }
}

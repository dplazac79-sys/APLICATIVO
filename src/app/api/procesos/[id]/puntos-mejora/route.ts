import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/http/errors'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { assertProyectoAccess } from '@/lib/auth/tenant'

// Acepta/rechaza un punto de mejora individual detectado por Discovery IA
// sobre un proceso (metadata_ia.puntos_mejora), sin afectar el estado_oferta
// del proceso mismo — el proceso ya está aceptado por definición (es el
// documento real de la organización); lo que aquí se decide es cada
// sugerencia de mejora puntual sobre su contenido.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const admin = createAdminClient()
    const { data: usuario } = await admin.from('usuario').select('rol').eq('id', user.id).single()
    const rolesAutorizados = ['super_admin', 'director_proyecto', 'consultor', 'sponsor_cliente', 'usuario_cliente']
    if (!usuario || !rolesAutorizados.includes(usuario.rol)) {
      return NextResponse.json({ error: 'Sin permisos para revisar puntos de mejora' }, { status: 403 })
    }

    const { punto_id, estado } = await req.json()
    if (!punto_id || !['aceptado', 'rechazado', 'propuesto'].includes(estado)) {
      return NextResponse.json({ error: 'punto_id y estado son requeridos (estado inválido)' }, { status: 400 })
    }

    const { data: procesoActual } = await admin
      .from('proceso')
      .select('metadata_ia, proyecto_id')
      .eq('id', params.id)
      .single()

    if (!procesoActual) return NextResponse.json({ error: 'Proceso no encontrado' }, { status: 404 })
    if (!(await assertProyectoAccess(user.id, procesoActual.proyecto_id as string))) {
      return NextResponse.json({ error: 'Sin acceso a este proceso' }, { status: 403 })
    }

    const meta = (procesoActual.metadata_ia ?? {}) as Record<string, unknown>
    const puntos = Array.isArray(meta.puntos_mejora) ? meta.puntos_mejora as Array<Record<string, unknown>> : []
    const idx = puntos.findIndex(p => p.id === punto_id)
    if (idx === -1) return NextResponse.json({ error: 'Punto de mejora no encontrado' }, { status: 404 })

    puntos[idx] = { ...puntos[idx], estado }

    const { data, error } = await admin
      .from('proceso')
      .update({ metadata_ia: { ...meta, puntos_mejora: puntos } })
      .eq('id', params.id)
      .select()
      .single()

    if (error) return jsonError(error)

    await registrarAudit({
      accion: estado === 'aceptado' ? 'APPROVE' : 'UPDATE',
      entidad: 'proceso',
      entidad_id: params.id,
      detalle: { punto_mejora_id: punto_id, estado },
    })

    return NextResponse.json({ ok: true, proceso: data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

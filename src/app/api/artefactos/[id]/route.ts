import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import type { EstadoValidacion } from '@/types/database'

// PATCH: actualizar contenido o estado_validacion de un artefacto
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const admin = createAdminClient()
    const { data: usuario } = await admin.from('usuario').select('rol').eq('id', user.id).single()
    if (!usuario) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await req.json()
    const { contenido, estado_validacion } = body as {
      contenido?: Record<string, unknown>
      estado_validacion?: EstadoValidacion
    }

    // sponsor_cliente y usuario_cliente solo pueden cambiar estado_validacion (validar/publicar)
    // No pueden editar el contenido del artefacto
    const rolesConsultor = ['super_admin', 'director_proyecto', 'consultor']
    const puedeEditarContenido = rolesConsultor.includes(usuario.rol)
    if (contenido !== undefined && !puedeEditarContenido) {
      return NextResponse.json({ error: 'Sin permisos para editar contenido' }, { status: 403 })
    }
    if (!puedeEditarContenido && estado_validacion === undefined) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { data: actual } = await admin
      .from('artefacto')
      .select('version, tipo, proceso_id, estado_validacion')
      .eq('id', params.id)
      .single()

    if (!actual) return NextResponse.json({ error: 'Artefacto no encontrado' }, { status: 404 })

    // Validar transiciones de estado usando el fetch ya hecho (evita doble query — M4)
    if (estado_validacion) {
      const transicionesValidas: Record<string, EstadoValidacion[]> = {
        pendiente: ['validado'],
        validado: ['publicado', 'pendiente'],
        publicado: ['validado'],
      }
      const estadoActual = actual.estado_validacion as EstadoValidacion
      if (!transicionesValidas[estadoActual]?.includes(estado_validacion)) {
        return NextResponse.json({
          error: `Transición inválida: ${estadoActual} → ${estado_validacion}`
        }, { status: 400 })
      }
    }

    // Guardar versión actual en historial antes de editar contenido
    const body2 = body as { motivo_cambio?: string }
    if (contenido !== undefined) {
      await admin.from('artefacto_historial').insert({
        artefacto_id: params.id,
        proceso_id: actual.proceso_id,
        tipo: actual.tipo,
        contenido: (actual as Record<string, unknown> & { contenido?: unknown }).contenido,
        version: actual.version,
        estado_validacion: actual.estado_validacion,
        modificado_por: user.id,
        motivo_cambio: body2.motivo_cambio ?? 'Edición manual',
      }) // fire-and-forget — historial no debe bloquear el guardado
    }

    const update: Record<string, unknown> = {}
    if (contenido !== undefined) {
      update.contenido = contenido
      update.version = actual.version + 1
      update.generado_por_ia = false
    }
    if (estado_validacion !== undefined) {
      update.estado_validacion = estado_validacion
    }

    const { data, error } = await admin
      .from('artefacto')
      .update(update)
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await registrarAudit({
      accion: estado_validacion === 'publicado' ? 'APPROVE' : 'UPDATE',
      entidad: 'artefacto',
      entidad_id: params.id,
      detalle: {
        tipo: actual.tipo,
        proceso_id: actual.proceso_id,
        ...(estado_validacion ? { estado_validacion } : {}),
        ...(contenido ? { editado_manualmente: true, version: actual.version + 1 } : {}),
      },
    })

    return NextResponse.json({ ok: true, artefacto: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// GET: obtener un artefacto por id
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data, error } = await supabase
      .from('artefacto')
      .select('*')
      .eq('id', params.id)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 404 })
    return NextResponse.json({ artefacto: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

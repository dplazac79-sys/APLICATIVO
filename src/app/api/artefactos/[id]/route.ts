import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/http/errors'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { assertProyectoAccess } from '@/lib/auth/tenant'
import { ROLES_EDITAN_ARTEFACTO, esStaffArtefacto, esTransicionValida } from '@/lib/artefactos-estado'
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
    // usuario_cliente es de solo lectura sobre artefactos — puede ver, no
    // editar contenido ni cambiar estado_validacion (eso incluía antes
    // auto-validar sus propios artefactos, algo reservado a sponsor_cliente
    // y al equipo interno según la política RLS artefacto_staff_update).
    if (!usuario || !ROLES_EDITAN_ARTEFACTO.includes(usuario.rol)) {
      return NextResponse.json({ error: 'Sin permisos para editar este artefacto' }, { status: 403 })
    }
    const esStaff = esStaffArtefacto(usuario.rol)

    // Un body vacío o JSON malformado (ej. un PATCH disparado sin datos)
    // hacía que req.json() lanzara y el catch genérico de más abajo
    // devolviera 500 con el mensaje crudo de la excepción — un detalle de
    // implementación filtrado al cliente en vez de un 400 controlado.
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Cuerpo de la solicitud inválido' }, { status: 400 })
    }
    const { contenido, estado_validacion, version_esperada } = body as {
      contenido?: Record<string, unknown>
      estado_validacion?: EstadoValidacion
      version_esperada?: number
    }

    const { data: actual } = await admin
      .from('artefacto')
      .select('version, tipo, proceso_id, estado_validacion, contenido, proceso:proceso_id(proyecto_id)')
      .eq('id', params.id)
      .single()

    if (!actual) return NextResponse.json({ error: 'Artefacto no encontrado' }, { status: 404 })

    const proyectoId = (actual.proceso as unknown as { proyecto_id: string } | null)?.proyecto_id
    if (!proyectoId || !(await assertProyectoAccess(user.id, proyectoId))) {
      return NextResponse.json({ error: 'Sin acceso a este artefacto' }, { status: 403 })
    }

    // Validar transiciones de estado usando el fetch ya hecho (evita doble query — M4)
    // Reglas centralizadas en @/lib/artefactos-estado (compartidas con el frontend).
    if (estado_validacion) {
      const estadoActual = actual.estado_validacion as EstadoValidacion
      if (!esTransicionValida(estadoActual, estado_validacion, esStaff)) {
        return NextResponse.json({
          error: `Transición inválida: ${estadoActual} → ${estado_validacion}`
        }, { status: 400 })
      }
    }

    let motivoCambio: string | undefined
    if (contenido !== undefined) {
      if (typeof contenido !== 'object' || Array.isArray(contenido)) {
        return NextResponse.json({ error: 'contenido debe ser un objeto' }, { status: 400 })
      }
      // No valida el esquema completo por tipo de artefacto (SIPOC/RACI/etc.
      // tienen formas distintas) — pero sí pone un techo razonable de
      // tamaño, para que un PATCH no pueda guardar un blob JSON arbitrario
      // de tamaño ilimitado que después rompa el render en VistaArtefacto.
      const tamanoBytes = new TextEncoder().encode(JSON.stringify(contenido)).length
      if (tamanoBytes > 300_000) {
        return NextResponse.json({ error: 'El contenido del artefacto es demasiado grande' }, { status: 413 })
      }
      const body2 = body as { motivo_cambio?: string }
      motivoCambio = body2.motivo_cambio?.trim()
      if (!motivoCambio) {
        return NextResponse.json({ error: 'Debes indicar el motivo del cambio' }, { status: 400 })
      }
    }

    const update: Record<string, unknown> = {}
    if (contenido !== undefined) {
      update.contenido = contenido
      update.version = actual.version + 1
      update.generado_por_ia = false
      // Editar el contenido de un artefacto ya validado/publicado lo regresa
      // a pendiente — antes quedaba con la insignia verde de "Validado" pese
      // a que el contenido detrás había cambiado, dando una falsa sensación
      // de aprobación vigente. Si esta misma request también trae un
      // estado_validacion explícito (ej. mejora con IA + re-validación en un
      // solo paso), ese valor tiene prioridad.
      if (estado_validacion === undefined && actual.estado_validacion !== 'pendiente') {
        update.estado_validacion = 'pendiente'
      }
    }
    if (estado_validacion !== undefined) {
      update.estado_validacion = estado_validacion
    }

    // Bloqueo optimista ATÓMICO: la condición "version = actual.version" va
    // en el propio UPDATE, no en un chequeo previo separado. Antes se leía
    // actual.version, se comparaba contra version_esperada, y RECIÉN AHÍ se
    // escribía sin condición — bajo carga real (doble clic, dos pestañas)
    // varias requests concurrentes pasaban el chequeo con el mismo valor
    // "viejo" antes de que ninguna hubiera escrito todavía, y todas
    // terminaban reportando éxito (200) aunque solo la última physically
    // ganara la escritura — un caso de TOCTOU detectado con pruebas de
    // concurrencia real (8 PATCH simultáneos), no solo en teoría.
    const versionCondicion = typeof version_esperada === 'number' ? version_esperada : actual.version
    const { data, error } = await admin
      .from('artefacto')
      .update(update)
      .eq('id', params.id)
      .eq('version', versionCondicion)
      .select()
      .maybeSingle()

    if (error) return jsonError(error)
    if (!data) {
      return NextResponse.json({ error: 'El artefacto fue modificado por otra persona. Recarga para ver la versión más reciente.' }, { status: 409 })
    }

    if (contenido !== undefined && motivoCambio) {
      await admin.from('artefacto_historial').insert({
        artefacto_id: params.id,
        proceso_id: actual.proceso_id,
        tipo: actual.tipo,
        contenido: (actual as Record<string, unknown> & { contenido?: unknown }).contenido,
        version: actual.version,
        estado_validacion: actual.estado_validacion,
        modificado_por: user.id,
        motivo_cambio: motivoCambio,
      }) // fire-and-forget — historial no debe bloquear la respuesta; solo se llega acá si la escritura atómica de arriba ya ganó la carrera
    }

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

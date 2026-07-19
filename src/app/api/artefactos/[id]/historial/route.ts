import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/http/errors'
import { errorResponse } from '@/lib/api/error-response'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertProyectoAccess } from '@/lib/auth/tenant'
import { ROLES_EDITAN_ARTEFACTO } from '@/lib/artefactos-estado'

// GET: obtener historial de versiones de un artefacto
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const admin = createAdminClient()

    // Esta ruta no tenía NINGÚN chequeo de acceso a proyecto — cualquier
    // usuario autenticado de cualquier proyecto podía leer el historial de
    // contenido de artefactos de otros clientes. Detectado creando un
    // segundo proyecto/usuario "intruso" y confirmando que leía datos
    // marcados como confidenciales de un proyecto al que nunca tuvo acceso.
    const { data: artefacto } = await admin.from('artefacto').select('proceso:proceso_id(proyecto_id)').eq('id', params.id).single()
    const proyectoId = (artefacto?.proceso as unknown as { proyecto_id: string } | null)?.proyecto_id
    if (!proyectoId || !(await assertProyectoAccess(user.id, proyectoId))) {
      return NextResponse.json({ error: 'Sin acceso a este artefacto' }, { status: 403 })
    }

    const { data, error } = await admin
      .from('artefacto_historial')
      .select('id, version, estado_validacion, motivo_cambio, modificado_por, created_at, contenido')
      .eq('artefacto_id', params.id)
      .order('version', { ascending: false })
      .limit(20)

    if (error) return jsonError(error)
    return NextResponse.json({ historial: data ?? [] })
  } catch (err) {
    return errorResponse(err, 500)
  }
}

// GET con ?ver=<version_id>: obtener contenido de una versión específica
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const admin = createAdminClient()

    // Restaurar una versión es una edición (sobreescribe el contenido
    // actual), así que exige el mismo rol que PATCH /api/artefactos/[id] —
    // sin esto, un usuario_cliente de solo lectura podía restaurar
    // versiones anteriores saltándose la restricción que sí se aplica en
    // la vía normal de edición.
    const { data: usuario } = await admin.from('usuario').select('rol').eq('id', user.id).single()
    if (!usuario || !ROLES_EDITAN_ARTEFACTO.includes(usuario.rol)) {
      return NextResponse.json({ error: 'Sin permisos para editar este artefacto' }, { status: 403 })
    }

    const { historial_id } = await req.json() as { historial_id: string }

    // Obtener contenido de esa versión
    const { data: histEntry } = await admin
      .from('artefacto_historial')
      .select('contenido, version')
      .eq('id', historial_id)
      .eq('artefacto_id', params.id)
      .single()

    if (!histEntry) return NextResponse.json({ error: 'Versión no encontrada' }, { status: 404 })

    // Restaurar: guardar versión actual en historial primero, luego actualizar
    const { data: actual } = await admin
      .from('artefacto')
      .select('*, proceso:proceso_id(proyecto_id)')
      .eq('id', params.id)
      .single()

    if (!actual) return NextResponse.json({ error: 'Artefacto no encontrado' }, { status: 404 })

    // Mismo hallazgo que en el GET de arriba, pero del lado de escritura:
    // sin este chequeo, cualquier usuario autenticado podía RESTAURAR (y
    // por lo tanto sobreescribir) el contenido de un artefacto de un
    // proyecto ajeno — confirmado en vivo corrompiendo un artefacto de
    // prueba desde una cuenta sin ninguna relación con ese proyecto.
    const proyectoId = (actual.proceso as unknown as { proyecto_id: string } | null)?.proyecto_id
    if (!proyectoId || !(await assertProyectoAccess(user.id, proyectoId))) {
      return NextResponse.json({ error: 'Sin acceso a este artefacto' }, { status: 403 })
    }

    await admin.from('artefacto_historial').insert({
      artefacto_id: params.id,
      proceso_id: actual.proceso_id,
      tipo: actual.tipo,
      contenido: actual.contenido,
      version: actual.version,
      estado_validacion: actual.estado_validacion,
      modificado_por: user.id,
      motivo_cambio: `Backup antes de restaurar v${histEntry.version}`,
    })

    const nuevaVersion = actual.version + 1
    await admin.from('artefacto').update({
      contenido: histEntry.contenido,
      version: nuevaVersion,
      estado_validacion: 'pendiente',
      generado_por_ia: false,
    }).eq('id', params.id)

    return NextResponse.json({ ok: true, version: nuevaVersion })
  } catch (err) {
    return errorResponse(err, 500)
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/http/errors'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { enviarEmail, templateCambioEstado } from '@/lib/email'
import { TRANSICIONES_VALIDAS, type WorkflowEstadoTipo } from '@/types/database'
import { assertProyectoAccess } from '@/lib/auth/tenant'
import { debeOcultarUsuario } from '@/lib/domain/visibilidad'

// GET: obtener workflow del proceso
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: proceso } = await admin.from('proceso').select('proyecto_id').eq('id', params.id).single()
  if (!proceso?.proyecto_id || !(await assertProyectoAccess(user.id, proceso.proyecto_id))) {
    return NextResponse.json({ error: 'Sin acceso a este proceso' }, { status: 403 })
  }

  const { data: usuario } = await admin.from('usuario').select('rol').eq('id', user.id).single()

  const { data } = await supabase
    .from('workflow_estado')
    .select('*, responsable:responsable_id(nombre, email)')
    .eq('proceso_id', params.id)
    .single()

  const workflow = data as (typeof data & { responsable_id: string | null }) | null
  if (workflow && debeOcultarUsuario(workflow.responsable_id, usuario?.rol, user.id)) {
    workflow.responsable = null
  }

  return NextResponse.json({ workflow: workflow ?? null })
}

// POST: crear workflow inicial para un proceso
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const { responsable_id, umbral_horas_n1, umbral_horas_n2, umbral_horas_n3, umbral_horas_n4 } = await req.json().catch(() => ({}))

  const { data: proceso } = await admin.from('proceso').select('proyecto_id').eq('id', params.id).single()
  if (!proceso) return NextResponse.json({ error: 'Proceso no encontrado' }, { status: 404 })

  if (!(await assertProyectoAccess(user.id, proceso.proyecto_id))) {
    return NextResponse.json({ error: 'Sin acceso a este proyecto' }, { status: 403 })
  }

  const { data, error } = await admin.from('workflow_estado').insert({
    proceso_id: params.id,
    proyecto_id: proceso.proyecto_id,
    estado: 'Scheduled',
    responsable_id: responsable_id ?? null,
    umbral_horas_n1: umbral_horas_n1 ?? 48,
    umbral_horas_n2: umbral_horas_n2 ?? 96,
    umbral_horas_n3: umbral_horas_n3 ?? 168,
    umbral_horas_n4: umbral_horas_n4 ?? 336,
  }).select().single()

  if (error) return jsonError(error)

  await registrarAudit({ accion: 'CREATE', entidad: 'workflow_estado', entidad_id: data.id, detalle: { proceso_id: params.id, estado_inicial: 'Scheduled' } })
  return NextResponse.json({ ok: true, workflow: data })
}

// PATCH: transicionar estado
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: usuario } = await admin.from('usuario').select('rol, nombre').eq('id', user.id).single()
  if (!usuario || !['super_admin', 'director_proyecto', 'consultor'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'Sin permisos para gestionar workflow' }, { status: 403 })
  }

  const { nuevo_estado, responsable_id } = await req.json() as { nuevo_estado: WorkflowEstadoTipo; responsable_id?: string }

  const { data: actual } = await admin.from('workflow_estado').select('*').eq('proceso_id', params.id).single()
  if (!actual) return NextResponse.json({ error: 'Workflow no inicializado para este proceso' }, { status: 404 })

  if (!(await assertProyectoAccess(user.id, actual.proyecto_id))) {
    return NextResponse.json({ error: 'Sin acceso a este proyecto' }, { status: 403 })
  }

  const estadoActual = actual.estado as WorkflowEstadoTipo
  const transicionesPermitidas = TRANSICIONES_VALIDAS[estadoActual] ?? []
  if (!transicionesPermitidas.includes(nuevo_estado)) {
    return NextResponse.json({
      error: `Transición inválida: ${estadoActual} → ${nuevo_estado}. Permitidas: ${transicionesPermitidas.join(', ')}`
    }, { status: 400 })
  }

  const { data, error } = await admin.from('workflow_estado').update({
    estado: nuevo_estado,
    nivel_escalacion: null, // reset escalación al cambiar estado
    fecha_cambio: new Date().toISOString(),
    responsable_id: responsable_id ?? actual.responsable_id,
  }).eq('proceso_id', params.id).select().single()

  if (error) return jsonError(error)

  await registrarAudit({
    accion: nuevo_estado === 'Approved' ? 'APPROVE' : 'UPDATE',
    entidad: 'workflow_estado',
    entidad_id: actual.id,
    detalle: { estado_anterior: estadoActual, estado_nuevo: nuevo_estado, proceso_id: params.id },
  })

  // Notificar al responsable (in-app + email)
  if (actual.responsable_id) {
    const esPendingApproval = nuevo_estado === 'Pending Approval'
    await admin.from('notificacion').insert({
      usuario_id: actual.responsable_id,
      proyecto_id: actual.proyecto_id,
      proceso_id: params.id,
      tipo: esPendingApproval ? 'aprobacion' : 'cambio_estado',
      titulo: esPendingApproval
        ? 'Proceso pendiente de aprobación'
        : `Proceso pasó a "${nuevo_estado}"`,
      cuerpo: `Cambio: ${estadoActual} → ${nuevo_estado}. Realizado por ${usuario.nombre ?? 'un consultor'}.`,
    })

    const { data: responsable } = await admin
      .from('usuario').select('email').eq('id', actual.responsable_id).single()

    if (responsable?.email) {
      // Obtener nombre del proyecto para el email
      const { data: proyecto } = await admin
        .from('proyecto').select('nombre').eq('id', actual.proyecto_id).single()

      void enviarEmail({
        to: responsable.email,
        subject: `[APIP] ${esPendingApproval ? 'Aprobación requerida' : 'Cambio de estado'} — ${proyecto?.nombre ?? 'Proyecto'}`,
        html: templateCambioEstado({
          proyecto: proyecto?.nombre ?? 'Proyecto',
          estado_anterior: estadoActual,
          estado_nuevo: nuevo_estado,
          usuario: usuario.nombre ?? 'un consultor',
        }),
      })
    }
  }

  return NextResponse.json({ ok: true, workflow: data })
}

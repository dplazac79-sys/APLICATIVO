import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { enviarEmail, templateEscalacion } from '@/lib/email'
import type { NivelEscalacion } from '@/types/database'
import { timingSafeEqual } from 'crypto'

// POST: evaluar y ejecutar escalaciones pendientes
// Llamado por GitHub Actions cron cada hora. Protegido con secret.
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-escalacion-secret') ?? ''
  const expected = process.env.ESCALACION_SECRET ?? ''
  const secretsMatch = secret.length === expected.length &&
    timingSafeEqual(Buffer.from(secret), Buffer.from(expected))
  if (!secretsMatch) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()
  const ahora = new Date()
  let escalados = 0

  // Obtener todos los workflows en estados no terminales
  const { data: workflows } = await admin
    .from('workflow_estado')
    .select('*, proceso:proceso_id(nombre, proyecto_id), proyecto:proyecto_id(nombre)')
    .not('estado', 'in', '("Closed","Approved","Implemented")')

  // Determinar qué workflows necesitan escalar
  type WfItem = NonNullable<typeof workflows>[number]
  type EscalacionItem = { wf: WfItem; nuevoNivel: NivelEscalacion; horasEnEstado: number }
  const aEscalar: EscalacionItem[] = []

  for (const wf of workflows ?? []) {
    const horasEnEstado = (ahora.getTime() - new Date(wf.fecha_cambio).getTime()) / 3600000
    const nivelActual = wf.nivel_escalacion as NivelEscalacion
    let nuevoNivel: NivelEscalacion = nivelActual

    if (!nivelActual && horasEnEstado >= wf.umbral_horas_n1) {
      nuevoNivel = 'N1'
    } else if (nivelActual === 'N1' && horasEnEstado >= wf.umbral_horas_n2) {
      nuevoNivel = 'N2'
    } else if (nivelActual === 'N2' && horasEnEstado >= wf.umbral_horas_n3) {
      nuevoNivel = 'N3'
    } else if (nivelActual === 'N3' && horasEnEstado >= wf.umbral_horas_n4) {
      nuevoNivel = 'N4'
    } else {
      continue
    }

    aEscalar.push({ wf, nuevoNivel, horasEnEstado })
  }

  if (aEscalar.length > 0) {
    // Batch update de niveles — 1 query en lugar de N
    await Promise.all(
      aEscalar.map(({ wf, nuevoNivel }) =>
        admin.from('workflow_estado').update({ nivel_escalacion: nuevoNivel }).eq('id', wf.id)
      )
    )

    // Obtener emails de todos los responsables — 1 query en lugar de N
    const responsableIdsSet: Record<string, true> = {}
    aEscalar.forEach(e => { if (e.wf.responsable_id) responsableIdsSet[e.wf.responsable_id] = true })
    const responsableIds = Object.keys(responsableIdsSet)
    const { data: responsables } = await admin
      .from('usuario').select('id, email').in('id', responsableIds)
    const emailMap = Object.fromEntries((responsables ?? []).map(r => [r.id, r.email as string]))

    // Batch insert de notificaciones — 1 query en lugar de N
    const notificaciones = aEscalar
      .filter(e => e.wf.responsable_id)
      .map(({ wf, nuevoNivel, horasEnEstado }) => {
        const proceso = wf.proceso as Record<string, unknown>
        const proyecto = wf.proyecto as Record<string, unknown>
        return {
          usuario_id: wf.responsable_id,
          proyecto_id: wf.proyecto_id,
          proceso_id: wf.proceso_id,
          tipo: 'escalacion',
          titulo: `Escalación ${nuevoNivel} — ${String(proceso?.nombre ?? 'Proceso')}`,
          cuerpo: `El proceso lleva ${Math.round(horasEnEstado)}h en estado "${wf.estado}" sin avanzar. Proyecto: ${String(proyecto?.nombre ?? '')}`,
        }
      })
    if (notificaciones.length > 0) {
      await admin.from('notificacion').insert(notificaciones)
    }

    // Emails en paralelo — no bloquear respuesta
    void Promise.all(
      aEscalar
        .filter(e => e.wf.responsable_id && emailMap[e.wf.responsable_id])
        .map(({ wf, nuevoNivel, horasEnEstado }) => {
          const proceso = wf.proceso as Record<string, unknown>
          const proyecto = wf.proyecto as Record<string, unknown>
          const descripcion = `El proceso lleva ${Math.round(horasEnEstado)}h en estado "${wf.estado}" sin avanzar. Proyecto: ${String(proyecto?.nombre ?? '')}`
          return enviarEmail({
            to: emailMap[wf.responsable_id!],
            subject: `[APIP] Escalación ${nuevoNivel} — ${String(proyecto?.nombre ?? 'Proyecto')}`,
            html: templateEscalacion({ proyecto: String(proyecto?.nombre ?? 'Proyecto'), nivel: String(nuevoNivel), descripcion }),
          })
        })
    )

    // Batch audit
    await Promise.all(
      aEscalar.map(({ wf, nuevoNivel, horasEnEstado }) =>
        registrarAudit({
          accion: 'UPDATE',
          entidad: 'workflow_estado',
          entidad_id: wf.id,
          detalle: { nivel_anterior: wf.nivel_escalacion, nivel_nuevo: nuevoNivel, horas_en_estado: Math.round(horasEnEstado), estado: wf.estado },
        })
      )
    )

    escalados = aEscalar.length
  }

  return NextResponse.json({ ok: true, escalados, evaluados: (workflows ?? []).length })
}

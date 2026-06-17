import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import type { NivelEscalacion } from '@/types/database'

// POST: evaluar y ejecutar escalaciones pendientes
// Llamado por GitHub Actions cron cada hora. Protegido con secret.
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-escalacion-secret')
  if (secret !== process.env.ESCALACION_SECRET) {
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

  for (const wf of workflows ?? []) {
    const horasEnEstado = (ahora.getTime() - new Date(wf.fecha_cambio).getTime()) / 3600000
    const nivelActual = wf.nivel_escalacion as NivelEscalacion

    let nuevoNivel: NivelEscalacion = nivelActual
    let escalar = false

    if (!nivelActual && horasEnEstado >= wf.umbral_horas_n1) {
      nuevoNivel = 'N1'; escalar = true
    } else if (nivelActual === 'N1' && horasEnEstado >= wf.umbral_horas_n2) {
      nuevoNivel = 'N2'; escalar = true
    } else if (nivelActual === 'N2' && horasEnEstado >= wf.umbral_horas_n3) {
      nuevoNivel = 'N3'; escalar = true
    } else if (nivelActual === 'N3' && horasEnEstado >= wf.umbral_horas_n4) {
      nuevoNivel = 'N4'; escalar = true
    }

    if (!escalar) continue

    await admin.from('workflow_estado').update({ nivel_escalacion: nuevoNivel }).eq('id', wf.id)

    const proceso = wf.proceso as Record<string, unknown>
    const proyecto = wf.proyecto as Record<string, unknown>

    // Notificar al responsable
    if (wf.responsable_id) {
      await admin.from('notificacion').insert({
        usuario_id: wf.responsable_id,
        proyecto_id: wf.proyecto_id,
        proceso_id: wf.proceso_id,
        tipo: 'escalacion',
        titulo: `Escalación ${nuevoNivel} — ${String(proceso?.nombre ?? 'Proceso')}`,
        cuerpo: `El proceso lleva ${Math.round(horasEnEstado)}h en estado "${wf.estado}" sin avanzar. Proyecto: ${String(proyecto?.nombre ?? '')}`,
      })
    }

    await registrarAudit({
      accion: 'UPDATE',
      entidad: 'workflow_estado',
      entidad_id: wf.id,
      detalle: { nivel_anterior: nivelActual, nivel_nuevo: nuevoNivel, horas_en_estado: Math.round(horasEnEstado), estado: wf.estado },
    })

    escalados++
  }

  return NextResponse.json({ ok: true, escalados, evaluados: (workflows ?? []).length })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inngest } from '@/lib/inngest/client'
import { registrarAudit } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const proyecto_id = params.id
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()

  let documento_ids: string[] | undefined
  try {
    const body = await req.json()
    if (Array.isArray(body?.documento_ids) && body.documento_ids.length > 0) {
      documento_ids = body.documento_ids
    }
  } catch { /* sin body — usa todos los documentos listos */ }

  // Crear job en BD para seguimiento
  const { data: job, error } = await admin.from('jobs').insert({
    tipo: 'discovery_procesos',
    estado: 'procesando',
    proyecto_id,
    payload: { proyecto_id, documento_ids: documento_ids ?? null },
  }).select().single()

  if (error || !job) return NextResponse.json({ error: 'No se pudo crear el job' }, { status: 500 })

  // Disparar job async — Inngest garantiza ejecución aunque la request termine
  await inngest.send({
    name: 'proyecto/discovery',
    data: { proyecto_id, usuario_id: user.id, documento_ids, job_id: job.id },
  })

  await registrarAudit({
    accion: 'RUN',
    entidad: 'discovery_job',
    entidad_id: job.id,
    detalle: { proyecto_id },
  })

  return NextResponse.json({ ok: true, job_id: job.id, status: 'encolado' })
}

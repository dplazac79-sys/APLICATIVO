import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { ejecutarCierreProyecto } from '@/lib/automation/job-cierre'
import { assertProyectoAccess, requireRole } from '@/lib/auth/tenant'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!(await requireRole(user.id, ['super_admin', 'director_proyecto']))) {
    return NextResponse.json({ error: 'Solo super_admin o director_proyecto pueden cerrar proyectos' }, { status: 403 })
  }
  if (!(await assertProyectoAccess(user.id, params.id))) {
    return NextResponse.json({ error: 'Sin acceso a este proyecto' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Verificar que el proyecto existe y está activo/pausado
  const { data: proyecto } = await admin
    .from('proyecto')
    .select('id, nombre, estado_general')
    .eq('id', params.id)
    .single()

  if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
  if (proyecto.estado_general === 'cerrado') {
    return NextResponse.json({ error: 'El proyecto ya está cerrado' }, { status: 400 })
  }

  // Marcar proyecto como cerrado
  await admin.from('proyecto').update({ estado_general: 'cerrado' }).eq('id', params.id)

  // Crear job de cierre en BD
  const { data: job } = await admin
    .from('kg_job_cierre')
    .insert({ proyecto_id: params.id, estado: 'pendiente' })
    .select()
    .single()

  await registrarAudit({
    accion: 'UPDATE',
    entidad: 'proyecto',
    entidad_id: params.id,
    detalle: { estado_general: 'cerrado', job_id: job?.id },
  })

  // Ejecutar job de extracción de patrones asíncronamente (fire-and-forget)
  if (job) {
    ejecutarCierreProyecto(params.id, job.id).catch(err => {
      console.error(`[cierre-proyecto] Falló job de cierre proyecto_id=${params.id} job_id=${job.id}:`, err instanceof Error ? err.message : err)
    })
  }

  return NextResponse.json({
    ok: true,
    proyecto_id: params.id,
    job_id: job?.id,
    mensaje: 'Proyecto cerrado. El Knowledge Graph se actualizará en segundo plano.',
  })
}

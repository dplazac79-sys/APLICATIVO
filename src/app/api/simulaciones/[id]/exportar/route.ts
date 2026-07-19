import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { assertProyectoAccess, requireRole } from '@/lib/auth/tenant'
import { errorResponse } from '@/lib/api/error-response'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!(await requireRole(user.id, ['super_admin', 'director_proyecto', 'consultor']))) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: sim, error: simErr } = await admin
    .from('simulacion')
    .select('*')
    .eq('id', params.id)
    .single()

  if (simErr || !sim) return NextResponse.json({ error: 'Simulación no encontrada' }, { status: 404 })

  if (!(await assertProyectoAccess(user.id, sim.proyecto_id))) {
    return NextResponse.json({ error: 'Sin acceso a esta simulación' }, { status: 403 })
  }

  // Crear entregable vinculado a la simulación
  const { data: entregable, error: entErr } = await admin
    .from('entregable')
    .insert({
      proyecto_id: sim.proyecto_id,
      simulacion_id: sim.id,
      artefacto_id: sim.artefacto_tobe_id ?? sim.artefacto_asis_id ?? null,
      tipo: 'simulacion',
      nombre: `Simulación ${sim.tipo} — ${sim.nombre}`,
      version: 1,
      estado: 'aprobado',
      contenido: {
        simulacion_id: sim.id,
        tipo: sim.tipo,
        escenario_principal: sim.escenario,
        parametros: sim.parametros,
        resultados_todos: sim.resultados_todos,
        proceso_referencia_id: sim.proceso_id,
        artefacto_asis_id: sim.artefacto_asis_id,
        artefacto_tobe_id: sim.artefacto_tobe_id,
        exportado_en: new Date().toISOString(),
      },
      creado_por: user.id,
    })
    .select()
    .single()

  if (entErr) return errorResponse(entErr, 500, 'No se pudo crear el entregable de la simulación.')

  // Vincular entregable a la simulación
  await admin.from('simulacion').update({ entregable_id: entregable.id }).eq('id', sim.id)

  await registrarAudit({
    accion: 'CREATE',
    entidad: 'entregable',
    entidad_id: entregable.id,
    detalle: { origen: 'simulacion', simulacion_id: sim.id, tipo: sim.tipo },
  })

  return NextResponse.json({ ok: true, entregable })
}

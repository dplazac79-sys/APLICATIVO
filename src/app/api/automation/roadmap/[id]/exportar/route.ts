import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { assertProyectoAccess, requireRole } from '@/lib/auth/tenant'
import { errorResponse } from '@/lib/api/error-response'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!(await requireRole(user.id, ['super_admin', 'director_proyecto', 'consultor']))) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Cargar roadmap con sus recomendaciones
  const { data: roadmap, error: errRoadmap } = await admin
    .from('kg_roadmap')
    .select('*, recomendaciones:kg_recomendacion(*)')
    .eq('id', params.id)
    .single()

  if (errRoadmap || !roadmap) {
    return NextResponse.json({ error: 'Roadmap no encontrado' }, { status: 404 })
  }

  if (!(await assertProyectoAccess(user.id, roadmap.proyecto_id))) {
    return NextResponse.json({ error: 'Sin acceso a este roadmap' }, { status: 403 })
  }

  // Crear entregable trazable
  const { data: entregable, error: errEnt } = await admin
    .from('entregable')
    .insert({
      proyecto_id: roadmap.proyecto_id,
      simulacion_id: null,
      tipo: 'reporte',
      nombre: `Roadmap de Automatización — ${roadmap.nombre}`,
      version: 1,
      estado: 'aprobado',
      contenido: {
        roadmap_id: roadmap.id,
        nombre: roadmap.nombre,
        descripcion: roadmap.descripcion,
        recomendaciones: roadmap.recomendaciones,
        exportado_en: new Date().toISOString(),
      },
      creado_por: user.id,
    })
    .select()
    .single()

  if (errEnt) return errorResponse(errEnt, 500, 'No se pudo crear el entregable del roadmap.')

  // Vincular entregable al roadmap
  await admin.from('kg_roadmap').update({
    entregable_id: entregable.id,
    estado: 'exportado',
  }).eq('id', params.id)

  await registrarAudit({
    accion: 'EXPORT',
    entidad: 'kg_roadmap',
    entidad_id: params.id,
    detalle: { entregable_id: entregable.id },
  })

  return NextResponse.json({ ok: true, entregable })
}

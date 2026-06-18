import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
  if (!['super_admin', 'director_proyecto', 'consultor'].includes(usuario?.rol ?? '')) {
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

  if (errEnt) return NextResponse.json({ error: errEnt.message }, { status: 500 })

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

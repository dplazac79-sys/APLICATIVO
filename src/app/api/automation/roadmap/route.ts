import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/http/errors'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { requireRole, assertProyectoAccess } from '@/lib/auth/tenant'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const proyecto_id = searchParams.get('proyecto_id')
  if (!proyecto_id) return NextResponse.json({ error: 'proyecto_id requerido' }, { status: 400 })

  const { data, error } = await supabase
    .from('kg_roadmap')
    .select('*, recomendaciones:kg_recomendacion(*)')
    .eq('proyecto_id', proyecto_id)
    .order('created_at', { ascending: false })

  if (error) return jsonError(error)
  return NextResponse.json({ roadmaps: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!(await requireRole(user.id, ['super_admin', 'director_proyecto', 'consultor']))) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { proyecto_id, nombre, descripcion, recomendacion_ids } = await req.json()
  if (!proyecto_id || !nombre) {
    return NextResponse.json({ error: 'proyecto_id y nombre requeridos' }, { status: 400 })
  }
  if (!(await assertProyectoAccess(user.id, proyecto_id))) {
    return NextResponse.json({ error: 'Sin acceso a este proyecto' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: roadmap, error } = await admin
    .from('kg_roadmap')
    .insert({ proyecto_id, nombre, descripcion: descripcion ?? null, creado_por: user.id })
    .select()
    .single()

  if (error) return jsonError(error)

  // Asociar recomendaciones al roadmap
  if (recomendacion_ids?.length) {
    await admin
      .from('kg_recomendacion')
      .update({ roadmap_id: roadmap.id, estado: 'aprobada' })
      .in('id', recomendacion_ids)
  }

  await registrarAudit({
    accion: 'CREATE',
    entidad: 'kg_roadmap',
    entidad_id: roadmap.id,
    detalle: { nombre, recomendaciones: recomendacion_ids?.length ?? 0 },
  })

  return NextResponse.json({ ok: true, roadmap })
}

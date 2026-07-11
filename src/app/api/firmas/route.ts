import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http/errors'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertProyectoAccess } from '@/lib/auth/tenant'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const { proyecto_id, artefacto_id, titulo, descripcion, firmante_nombre, firmante_cargo } = body

  if (!proyecto_id || !titulo) {
    return NextResponse.json({ error: 'proyecto_id y título son requeridos' }, { status: 400 })
  }

  if (!(await assertProyectoAccess(user.id, proyecto_id))) {
    return NextResponse.json({ error: 'Sin acceso a este proyecto' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('firma_solicitud')
    .insert({
      proyecto_id,
      artefacto_id: artefacto_id ?? null,
      titulo,
      descripcion: descripcion || null,
      solicitado_por: user.id,
      firmante_nombre: firmante_nombre || null,
      firmante_cargo: firmante_cargo || null,
    })
    .select()
    .single()

  if (error) return jsonError(error)
  return NextResponse.json(data)
}

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const proyectoId = searchParams.get('proyecto_id')
  const artefactoId = searchParams.get('artefacto_id')

  // proyecto_id es obligatorio: sin él, la query no tenía ningún filtro y
  // devolvía las solicitudes de firma de TODOS los proyectos de TODOS los
  // clientes a cualquier usuario autenticado.
  if (!proyectoId) {
    return NextResponse.json({ error: 'proyecto_id requerido' }, { status: 400 })
  }
  if (!(await assertProyectoAccess(user.id, proyectoId))) {
    return NextResponse.json({ error: 'Sin acceso a este proyecto' }, { status: 403 })
  }

  const admin = createAdminClient()
  let query = admin.from('firma_solicitud').select('*').eq('proyecto_id', proyectoId).order('created_at', { ascending: false })
  if (artefactoId) query = query.eq('artefacto_id', artefactoId)

  const { data, error } = await query
  if (error) return jsonError(error)
  return NextResponse.json(data ?? [])
}

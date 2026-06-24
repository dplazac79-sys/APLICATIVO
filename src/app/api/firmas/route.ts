import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const { proyecto_id, artefacto_id, titulo, descripcion, firmante_nombre, firmante_cargo } = body

  if (!proyecto_id || !titulo) {
    return NextResponse.json({ error: 'proyecto_id y título son requeridos' }, { status: 400 })
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const proyectoId = searchParams.get('proyecto_id')
  const artefactoId = searchParams.get('artefacto_id')

  const admin = createAdminClient()
  let query = admin.from('firma_solicitud').select('*').order('created_at', { ascending: false })
  if (proyectoId) query = query.eq('proyecto_id', proyectoId)
  if (artefactoId) query = query.eq('artefacto_id', artefactoId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

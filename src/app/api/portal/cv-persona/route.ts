import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/http/errors'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json() as {
    proyecto_id: string
    organigrama_id?: string
    nombre_persona: string
    cargo_actual: string
    texto_cv?: string
  }

  if (!body.proyecto_id || !body.nombre_persona)
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })

  const admin = createAdminClient()
  const { data: acceso } = await admin.from('usuario_proyecto')
    .select('id').eq('usuario_id', user.id).eq('proyecto_id', body.proyecto_id).maybeSingle()
  if (!acceso) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const { data, error } = await admin.from('cv_persona_org').insert({
    proyecto_id:    body.proyecto_id,
    organigrama_id: body.organigrama_id ?? null,
    nombre_persona: body.nombre_persona,
    cargo_actual:   body.cargo_actual,
    texto_cv:       body.texto_cv ?? null,
  }).select().single()

  if (error) return jsonError(error)
  return NextResponse.json({ ok: true, persona: data })
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const proyectoId = req.nextUrl.searchParams.get('proyecto_id')
  if (!proyectoId) return NextResponse.json({ error: 'Falta proyecto_id' }, { status: 400 })

  const admin = createAdminClient()
  const { data } = await admin.from('cv_persona_org')
    .select('id, nombre_persona, cargo_actual, created_at')
    .eq('proyecto_id', proyectoId)
    .order('nombre_persona')

  return NextResponse.json({ personas: data ?? [] })
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const admin = createAdminClient()
  await admin.from('cv_persona_org').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}

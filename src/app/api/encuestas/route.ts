import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertProyectoAccess } from '@/lib/auth/tenant'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const { artefacto_id, proyecto_id, puntuacion, comentario } = body

  if (!artefacto_id || !proyecto_id || !puntuacion) {
    return NextResponse.json({ error: 'Campos requeridos' }, { status: 400 })
  }
  if (puntuacion < 1 || puntuacion > 5) {
    return NextResponse.json({ error: 'Puntuación inválida' }, { status: 400 })
  }
  if (!(await assertProyectoAccess(user.id, proyecto_id))) {
    return NextResponse.json({ error: 'Sin acceso a este proyecto' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('encuesta_feedback')
    .upsert({
      artefacto_id,
      proyecto_id,
      usuario_id: user.id,
      puntuacion,
      comentario: comentario || null,
    }, { onConflict: 'artefacto_id,usuario_id' })
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
  const artefactoId = searchParams.get('artefacto_id')
  if (!artefactoId) return NextResponse.json({ error: 'artefacto_id requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('encuesta_feedback')
    .select('*')
    .eq('artefacto_id', artefactoId)

  const encuestas = data ?? []
  const promedio = encuestas.length
    ? encuestas.reduce((s, e) => s + e.puntuacion, 0) / encuestas.length
    : null

  const mia = encuestas.find(e => e.usuario_id === user.id)
  return NextResponse.json({ encuestas, promedio, mia: mia ?? null })
}

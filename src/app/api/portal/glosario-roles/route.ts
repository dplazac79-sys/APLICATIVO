import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inngest } from '@/lib/inngest/client'

// GET — obtener último análisis
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const proyectoId = req.nextUrl.searchParams.get('proyecto_id')
  if (!proyectoId) return NextResponse.json({ error: 'Falta proyecto_id' }, { status: 400 })

  const admin = createAdminClient()
  const { data } = await admin.from('glosario_roles_analisis')
    .select('*')
    .eq('proyecto_id', proyectoId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ analisis: data })
}

// POST — lanzar nuevo análisis
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json() as {
    proyecto_id: string
    organigrama_id: string
    roles_en_procesos: Array<{ rol: string; descripcion: string; procesos: string[] }>
  }
  if (!body.proyecto_id || !body.organigrama_id)
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })

  const admin = createAdminClient()
  const { data: acceso } = await admin.from('usuario_proyecto')
    .select('id').eq('usuario_id', user.id).eq('proyecto_id', body.proyecto_id).maybeSingle()
  if (!acceso) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  // Crear registro de análisis
  const { data: analisis, error } = await admin.from('glosario_roles_analisis').insert({
    proyecto_id:      body.proyecto_id,
    organigrama_id:   body.organigrama_id,
    roles_en_procesos: body.roles_en_procesos,
    estado:           'generando',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Disparar job Inngest
  await inngest.send({
    name: 'portal/analizar-glosario-roles',
    data: { analisis_id: analisis.id, proyecto_id: body.proyecto_id },
  })

  return NextResponse.json({ ok: true, analisis_id: analisis.id })
}

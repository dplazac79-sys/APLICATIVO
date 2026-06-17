import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const proyecto_id = searchParams.get('proyecto_id')
  if (!proyecto_id) return NextResponse.json({ error: 'proyecto_id requerido' }, { status: 400 })
  const admin = createAdminClient()
  const { data } = await admin.from('riesgo').select('*').eq('proyecto_id', proyecto_id).order('created_at', { ascending: false })
  return NextResponse.json({ riesgos: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  if (!body.proyecto_id || !body.descripcion) {
    return NextResponse.json({ error: 'proyecto_id y descripcion requeridos' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('riesgo').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await registrarAudit({ accion: 'CREATE', entidad: 'riesgo', entidad_id: data.id, detalle: { descripcion: body.descripcion } })
  return NextResponse.json({ ok: true, riesgo: data })
}

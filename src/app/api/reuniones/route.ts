import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const proyecto_id = searchParams.get('proyecto_id')
  if (!proyecto_id) return NextResponse.json({ error: 'proyecto_id requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { data } = await admin.from('reunion').select('*').eq('proyecto_id', proyecto_id).order('fecha', { ascending: false })
  return NextResponse.json({ reuniones: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { proyecto_id, fecha, titulo, participantes, acuerdos, compromisos } = body
  if (!proyecto_id || !fecha || !titulo) {
    return NextResponse.json({ error: 'proyecto_id, fecha y titulo son requeridos' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('reunion').insert({
    proyecto_id, fecha, titulo,
    participantes: participantes ?? [],
    acuerdos: acuerdos ?? null,
    compromisos: compromisos ?? [],
    created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await registrarAudit({ accion: 'CREATE', entidad: 'reunion', entidad_id: data.id, detalle: { titulo, proyecto_id } })
  return NextResponse.json({ ok: true, reunion: data })
}

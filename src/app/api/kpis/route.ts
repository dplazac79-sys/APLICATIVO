import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const proyecto_id = searchParams.get('proyecto_id')
  if (!proyecto_id) return NextResponse.json({ error: 'proyecto_id requerido' }, { status: 400 })

  const { data } = await supabase.from('kpi').select('*').eq('proyecto_id', proyecto_id).order('created_at')
  return NextResponse.json({ kpis: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
  if (!usuario || !['super_admin', 'director_proyecto', 'consultor'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'Sin permisos para crear KPIs' }, { status: 403 })
  }

  const body = await req.json()
  if (!body.proyecto_id || !body.nombre) {
    return NextResponse.json({ error: 'proyecto_id y nombre requeridos' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('kpi').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await registrarAudit({ accion: 'CREATE', entidad: 'kpi', entidad_id: data.id, detalle: { nombre: body.nombre } })
  return NextResponse.json({ ok: true, kpi: data })
}

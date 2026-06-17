import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'

type Probabilidad = 'alta' | 'media' | 'baja'
type Impacto = 'alto' | 'medio' | 'bajo'
type NivelRiesgo = 'critico' | 'alto' | 'medio' | 'bajo'

function calcularNivelRiesgo(probabilidad: Probabilidad, impacto: Impacto): NivelRiesgo {
  if (probabilidad === 'alta' && impacto === 'alto') return 'critico'
  if (probabilidad === 'alta' && impacto === 'medio') return 'alto'
  if (probabilidad === 'alta' && impacto === 'bajo') return 'medio'
  if (probabilidad === 'media' && impacto === 'alto') return 'alto'
  if (probabilidad === 'media' && impacto === 'medio') return 'medio'
  if (probabilidad === 'media' && impacto === 'bajo') return 'bajo'
  if (probabilidad === 'baja' && impacto === 'alto') return 'medio'
  if (probabilidad === 'baja' && impacto === 'medio') return 'bajo'
  return 'bajo' // baja × bajo
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const proyecto_id = searchParams.get('proyecto_id')
  if (!proyecto_id) return NextResponse.json({ error: 'proyecto_id requerido' }, { status: 400 })

  const { data } = await supabase.from('riesgo').select('*').eq('proyecto_id', proyecto_id).order('created_at', { ascending: false })
  return NextResponse.json({ riesgos: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
  if (!usuario || !['super_admin', 'director_proyecto', 'consultor'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'Sin permisos para registrar riesgos' }, { status: 403 })
  }

  const body = await req.json()
  if (!body.proyecto_id || !body.descripcion) {
    return NextResponse.json({ error: 'proyecto_id y descripcion requeridos' }, { status: 400 })
  }

  const nivel_riesgo = calcularNivelRiesgo(
    (body.probabilidad ?? 'media') as Probabilidad,
    (body.impacto ?? 'medio') as Impacto,
  )

  const admin = createAdminClient()
  const { data, error } = await admin.from('riesgo').insert({ ...body, nivel_riesgo }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await registrarAudit({ accion: 'CREATE', entidad: 'riesgo', entidad_id: data.id, detalle: { descripcion: body.descripcion, nivel_riesgo } })
  return NextResponse.json({ ok: true, riesgo: data })
}

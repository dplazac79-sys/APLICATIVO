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
  return 'bajo'
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
  if (!usuario || !['super_admin', 'director_proyecto', 'consultor'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'Sin permisos para editar riesgos' }, { status: 403 })
  }

  const admin = createAdminClient()
  const body = await req.json()

  // Recalcular nivel_riesgo si cambian probabilidad o impacto
  const updates = { ...body }
  if (body.probabilidad || body.impacto) {
    const { data: actual } = await admin.from('riesgo').select('probabilidad, impacto').eq('id', params.id).single()
    const prob = (body.probabilidad ?? actual?.probabilidad ?? 'media') as Probabilidad
    const imp = (body.impacto ?? actual?.impacto ?? 'medio') as Impacto
    updates.nivel_riesgo = calcularNivelRiesgo(prob, imp)
  }

  const { data, error } = await admin.from('riesgo').update(updates).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await registrarAudit({ accion: 'UPDATE', entidad: 'riesgo', entidad_id: params.id, detalle: updates })
  return NextResponse.json({ ok: true, riesgo: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
  if (!usuario || !['super_admin', 'director_proyecto', 'consultor'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'Sin permisos para eliminar riesgos' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('riesgo').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

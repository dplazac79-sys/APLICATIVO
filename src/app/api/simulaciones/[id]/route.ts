import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { simularOperacional } from '@/lib/simulacion/operacional'
import { simularFinanciera } from '@/lib/simulacion/financiera'
import { simularOrganizacional } from '@/lib/simulacion/organizacional'
import { assertProyectoAccess } from '@/lib/auth/tenant'
import type { ParametrosOperacional, ParametrosFinanciera, ParametrosOrganizacional, TipoSimulacion, Escenario } from '@/lib/simulacion/tipos'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('simulacion')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({ simulacion: data })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
  if (!usuario || !['super_admin', 'director_proyecto', 'consultor'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await req.json()
  const admin = createAdminClient()

  // Obtener simulación actual para saber el tipo
  const { data: actual } = await admin.from('simulacion').select('tipo, parametros, proyecto_id').eq('id', params.id).single()
  if (!actual) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  if (!(await assertProyectoAccess(user.id, actual.proyecto_id))) {
    return NextResponse.json({ error: 'Sin acceso a esta simulación' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {}
  if (body.nombre !== undefined) updates.nombre = body.nombre
  if (body.escenario !== undefined) updates.escenario = body.escenario
  if (body.artefacto_asis_id !== undefined) updates.artefacto_asis_id = body.artefacto_asis_id
  if (body.artefacto_tobe_id !== undefined) updates.artefacto_tobe_id = body.artefacto_tobe_id

  // Si cambian parámetros, recalcular
  if (body.parametros !== undefined) {
    updates.parametros = body.parametros
    const resultados_todos = ejecutarMotor(actual.tipo as TipoSimulacion, body.parametros)
    updates.resultados_todos = resultados_todos
    const escenario = (body.escenario ?? actual.parametros?.escenario ?? 'base') as Escenario
    updates.resultados = resultados_todos[escenario]
  }

  const { data, error } = await admin.from('simulacion').update(updates).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await registrarAudit({ accion: 'UPDATE', entidad: 'simulacion', entidad_id: params.id, detalle: updates })
  return NextResponse.json({ ok: true, simulacion: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
  if (!usuario || !['super_admin', 'director_proyecto', 'consultor'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: sim } = await admin.from('simulacion').select('proyecto_id').eq('id', params.id).single()
  if (!sim) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (!(await assertProyectoAccess(user.id, sim.proyecto_id))) {
    return NextResponse.json({ error: 'Sin acceso a esta simulación' }, { status: 403 })
  }

  const { error } = await admin.from('simulacion').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

function ejecutarMotor(tipo: TipoSimulacion, parametros: unknown) {
  switch (tipo) {
    case 'operacional':
      return simularOperacional(parametros as ParametrosOperacional)
    case 'financiera':
      return simularFinanciera(parametros as ParametrosFinanciera)
    case 'organizacional':
      return simularOrganizacional(parametros as ParametrosOrganizacional)
  }
}

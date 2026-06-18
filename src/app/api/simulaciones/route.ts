import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { simularOperacional } from '@/lib/simulacion/operacional'
import { simularFinanciera } from '@/lib/simulacion/financiera'
import { simularOrganizacional } from '@/lib/simulacion/organizacional'
import type {
  ParametrosOperacional,
  ParametrosFinanciera,
  ParametrosOrganizacional,
  TipoSimulacion,
  Escenario,
} from '@/lib/simulacion/tipos'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const proyecto_id = searchParams.get('proyecto_id')
  if (!proyecto_id) return NextResponse.json({ error: 'proyecto_id requerido' }, { status: 400 })

  const { data, error } = await supabase
    .from('simulacion')
    .select('id, nombre, tipo, escenario, parametros, resultados, resultados_todos, proceso_id, artefacto_asis_id, artefacto_tobe_id, entregable_id, creado_por, created_at, updated_at')
    .eq('proyecto_id', proyecto_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ simulaciones: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
  if (!usuario || !['super_admin', 'director_proyecto', 'consultor'].includes(usuario.rol)) {
    return NextResponse.json({ error: 'Sin permisos para crear simulaciones' }, { status: 403 })
  }

  const body = await req.json()
  const { proyecto_id, nombre, tipo, escenario, parametros, proceso_id, artefacto_asis_id, artefacto_tobe_id } = body

  if (!proyecto_id || !nombre || !tipo || !escenario || !parametros) {
    return NextResponse.json({ error: 'proyecto_id, nombre, tipo, escenario y parametros son requeridos' }, { status: 400 })
  }

  const tiposValidos: TipoSimulacion[] = ['operacional', 'financiera', 'organizacional']
  const escenariosValidos: Escenario[] = ['conservador', 'base', 'optimista', 'custom']
  if (!tiposValidos.includes(tipo as TipoSimulacion)) {
    return NextResponse.json({ error: `tipo debe ser uno de: ${tiposValidos.join(', ')}` }, { status: 400 })
  }
  if (!escenariosValidos.includes(escenario as Escenario)) {
    return NextResponse.json({ error: `escenario debe ser uno de: ${escenariosValidos.join(', ')}` }, { status: 400 })
  }

  const resultados_todos = ejecutarMotor(tipo as TipoSimulacion, parametros)
  const resultados = resultados_todos[escenario as Escenario]

  const admin = createAdminClient()
  const payload = {
    proyecto_id,
    nombre,
    tipo,
    escenario,
    parametros,
    resultados,
    resultados_todos,
    proceso_id: proceso_id ?? null,
    artefacto_asis_id: artefacto_asis_id ?? null,
    artefacto_tobe_id: artefacto_tobe_id ?? null,
    creado_por: user.id,
  }

  const { data, error } = await admin.from('simulacion').insert(payload).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await registrarAudit({
    accion: 'CREATE',
    entidad: 'simulacion',
    entidad_id: data.id,
    detalle: { nombre, tipo, escenario },
  })

  return NextResponse.json({ ok: true, simulacion: data })
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

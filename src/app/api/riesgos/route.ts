import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/http/errors'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { calcularNivelRiesgo, type Probabilidad, type Impacto } from '@/lib/riesgos'
import { assertProyectoAccess, requireRole } from '@/lib/auth/tenant'

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

    if (!(await requireRole(user.id, ['super_admin', 'director_proyecto', 'consultor']))) {
    return NextResponse.json({ error: 'Sin permisos para registrar riesgos' }, { status: 403 })
  }

  const body = await req.json()
  if (!body.proyecto_id || !body.descripcion) {
    return NextResponse.json({ error: 'proyecto_id y descripcion requeridos' }, { status: 400 })
  }
  if (!(await assertProyectoAccess(user.id, body.proyecto_id))) {
    return NextResponse.json({ error: 'Sin acceso a este proyecto' }, { status: 403 })
  }

  const nivel_riesgo = calcularNivelRiesgo(
    (body.probabilidad ?? 'media') as Probabilidad,
    (body.impacto ?? 'medio') as Impacto,
  )

  const admin = createAdminClient()

  // Deduplicado server-side — la guardia del botón (disabled mientras
  // cargando) no alcanza a frenar dos clics verdaderamente simultáneos
  // (mismo problema real encontrado en el bloqueo optimista de artefactos):
  // si ya existe un riesgo con la misma descripción creado en los últimos
  // 5 segundos en este proyecto, se asume que es un duplicado por doble
  // clic y se devuelve el existente en vez de crear uno nuevo.
  const cincoSegundosAtras = new Date(Date.now() - 5000).toISOString()
  const { data: posibleDuplicado } = await admin
    .from('riesgo')
    .select('*')
    .eq('proyecto_id', body.proyecto_id)
    .eq('descripcion', body.descripcion)
    .gte('created_at', cincoSegundosAtras)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (posibleDuplicado) {
    return NextResponse.json({ ok: true, riesgo: posibleDuplicado })
  }

  // Allowlist explícito en vez de spread del body completo — evita que el
  // cliente fije campos fuera de su control (estado, created_at, id, etc.)
  const payload = {
    proyecto_id: body.proyecto_id,
    proceso_id: body.proceso_id ?? null,
    descripcion: body.descripcion,
    categoria: body.categoria ?? 'operacional',
    probabilidad: body.probabilidad ?? 'media',
    impacto: body.impacto ?? 'medio',
    control: body.control ?? null,
    responsable: body.responsable ?? null,
    nivel_riesgo,
  }
  const { data, error } = await admin.from('riesgo').insert(payload).select().single()
  if (error) return jsonError(error)
  await registrarAudit({ accion: 'CREATE', entidad: 'riesgo', entidad_id: data.id, detalle: { descripcion: body.descripcion, nivel_riesgo } })
  return NextResponse.json({ ok: true, riesgo: data })
}

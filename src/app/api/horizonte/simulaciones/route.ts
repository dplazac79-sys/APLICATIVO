import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertProyectoAccess, requireRole } from '@/lib/auth/tenant'
import { registrarAudit } from '@/lib/audit'

// Incluye roles cliente: correr una simulación de Horizonte de Impacto es la
// acción que marca esa fase como completada (ver lib/fases.ts) — si solo el
// equipo consultor pudiera guardar, un cliente que ejecuta su propia
// simulación nunca vería la fase avanzar, aunque ya hizo lo que se le pedía.
const ROLES_GUARDAN = ['super_admin', 'director_proyecto', 'consultor', 'sponsor_cliente', 'usuario_cliente'] as const

// GET: lista simulaciones guardadas de un proceso (cualquier rol con acceso al proyecto)
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const procesoId = req.nextUrl.searchParams.get('proceso_id')
  if (!procesoId) return NextResponse.json({ error: 'Falta proceso_id' }, { status: 400 })

  const admin = createAdminClient()
  const { data: proceso } = await admin.from('proceso').select('proyecto_id').eq('id', procesoId).single()
  if (!proceso) return NextResponse.json({ error: 'Proceso no encontrado' }, { status: 404 })

  if (!(await assertProyectoAccess(user.id, proceso.proyecto_id))) {
    return NextResponse.json({ error: 'Sin acceso a este proceso' }, { status: 403 })
  }

  const { data: simulaciones, error } = await admin
    .from('simulacion')
    .select('id, nombre, escenario, resultados, creado_por, created_at, usuario:creado_por(nombre)')
    .eq('proceso_id', procesoId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ simulaciones })
}

// POST: guarda una simulación ya generada — solo equipo AICOUNTS
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  if (!(await requireRole(user.id, ROLES_GUARDAN))) {
    return NextResponse.json({ error: 'Tu rol no tiene permiso para guardar simulaciones' }, { status: 403 })
  }

  const body = await req.json() as {
    proceso_id: string
    artefacto_ids?: string[]
    resultados: Record<string, unknown>
  }
  const { proceso_id, artefacto_ids, resultados } = body
  if (!proceso_id || !resultados) {
    return NextResponse.json({ error: 'Faltan proceso_id o resultados' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: proceso } = await admin
    .from('proceso').select('nombre, codigo, proyecto_id').eq('id', proceso_id).single()
  if (!proceso) return NextResponse.json({ error: 'Proceso no encontrado' }, { status: 404 })

  if (!(await assertProyectoAccess(user.id, proceso.proyecto_id))) {
    return NextResponse.json({ error: 'Sin acceso a este proceso' }, { status: 403 })
  }

  const { data: simulacion, error } = await admin
    .from('simulacion')
    .insert({
      proyecto_id: proceso.proyecto_id,
      proceso_id,
      nombre: `Impacto de ${proceso.codigo ?? proceso.nombre}`,
      tipo: 'operacional',
      escenario: 'base',
      parametros: { artefacto_ids: artefacto_ids ?? [] },
      resultados,
      creado_por: user.id,
    })
    .select('id, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await registrarAudit({
    accion: 'CREATE',
    entidad: 'simulacion',
    entidad_id: simulacion.id,
    detalle: { proceso: proceso.nombre },
    usuarioId: user.id,
  })

  return NextResponse.json({ simulacion })
}

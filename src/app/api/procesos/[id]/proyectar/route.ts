import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildProcesoContext } from '@/lib/ai/context'
import { proyectarProceso } from '@/lib/ai/claude'
import { verificarLimiteIA, registrarUsoIA } from '@/lib/ai/rate-limit'
import { registrarAudit } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const procesoId = params.id
  const body = await req.json().catch(() => ({}))
  const incluir_automatizacion = body.incluir_automatizacion ?? false

  try {
    // Context manager: lee desde DB, no re-procesa archivos
    const ctx = await buildProcesoContext(procesoId)

    const limite = await verificarLimiteIA(
      (ctx.proceso as any).proyecto_id ?? '',
      'resumir'
    )
    if (!limite.permitido) {
      return NextResponse.json({ error: limite.mensaje }, { status: 429 })
    }

    const proyeccion = await proyectarProceso(
      ctx.proceso_contexto,
      ctx.proyecto_contexto,
      { incluir_automatizacion }
    )

    // Guardar en metadata_ia del proceso para evitar re-calcular
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()
    await admin.from('proceso').update({
      metadata_ia: {
        ...(ctx.proceso.metadata_ia ?? {}),
        proyeccion_ia: proyeccion,
        proyeccion_generada_at: new Date().toISOString(),
      },
    }).eq('id', procesoId)

    await registrarUsoIA({
      proyecto_id: (ctx.proceso as any).proyecto_id ?? '',
      usuario_id: user.id,
      tipo: 'resumir',
      tokens_input: 3000,
      tokens_output: 2000,
    })

    await registrarAudit({
      accion: 'CREATE',
      entidad: 'proyeccion_proceso',
      entidad_id: procesoId,
      detalle: { nivel_confianza: proyeccion.nivel_confianza, total_mejoras: proyeccion.mejoras_propuestas.length },
      usuarioId: user.id,
    })

    return NextResponse.json({ proyeccion })
  } catch (err) {
    console.error('[proyectar]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al generar proyección' },
      { status: 500 }
    )
  }
}

// GET: devuelve proyección guardada en metadata_ia (sin re-calcular)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const { data } = await admin.from('proceso').select('metadata_ia').eq('id', params.id).single()

  const proyeccion = (data?.metadata_ia as any)?.proyeccion_ia ?? null
  const generada_at = (data?.metadata_ia as any)?.proyeccion_generada_at ?? null

  return NextResponse.json({ proyeccion, generada_at })
}

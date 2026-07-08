import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const body = await req.json() as { correcciones: unknown[]; oportunidades_checkeadas?: unknown[]; quickwins_checkeados?: unknown[]; pasos_checkeados?: unknown[] }

  const { data: proceso } = await admin
    .from('proceso')
    .select('metadata_ia')
    .eq('id', params.id)
    .single()

  if (!proceso) return NextResponse.json({ error: 'no_encontrado' }, { status: 404 })

  const metaActual = (proceso.metadata_ia ?? {}) as Record<string, unknown>
  const patch: Record<string, unknown> = {
    ...metaActual,
    correcciones: body.correcciones,
  }
  if (body.oportunidades_checkeadas !== undefined) patch.oportunidades_checkeadas = body.oportunidades_checkeadas
  if (body.quickwins_checkeados !== undefined) patch.quickwins_checkeados = body.quickwins_checkeados
  if (body.pasos_checkeados !== undefined) patch.pasos_checkeados = body.pasos_checkeados

  const { data: updated, error } = await admin
    .from('proceso')
    .update({ metadata_ia: patch })
    .eq('id', params.id)
    .select('proyecto_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const numCorrecciones = Array.isArray(body.correcciones)
    ? (body.correcciones as Array<{ estado: string }>).filter(c => c.estado === 'pendiente').length : 0
  if (numCorrecciones > 0 && updated) {
    await admin.from('proceso_historial').insert({
      proceso_id: params.id,
      proyecto_id: updated.proyecto_id,
      version: 1,
      tipo_cambio: 'correccion_cliente',
      descripcion: `El cliente registró ${numCorrecciones} observación${numCorrecciones > 1 ? 'es' : ''} para revisión`,
      detalle: { total_correcciones: numCorrecciones },
      modificado_por: user.id,
    }).then(() => null, () => null)
  }

  return NextResponse.json({ ok: true })
}

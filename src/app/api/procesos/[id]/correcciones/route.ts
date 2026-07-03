import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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

  const { error } = await admin
    .from('proceso')
    .update({ metadata_ia: patch })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

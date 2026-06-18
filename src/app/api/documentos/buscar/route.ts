import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generarEmbedding } from '@/lib/ai/embeddings'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const { query, proyecto_id } = await req.json()
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'query requerida' }, { status: 400 })
    }

    const queryEmbedding = await generarEmbedding(query, 'query')
    const admin = createAdminClient()

    const { data, error } = await admin.rpc('buscar_documentos_semantico', {
      query_embedding: queryEmbedding,
      filtro_proyecto_id: proyecto_id ?? null,
      limite: 10,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, resultados: data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[buscar] Error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

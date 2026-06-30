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

    const admin = createAdminClient()

    // 1. Búsqueda por nombre de archivo (siempre funciona, incluso sin embedding)
    let nombreQuery = admin
      .from('documento')
      .select('id, proyecto_id, nombre_archivo, resumen_ejecutivo, clasificacion, estado_procesamiento')
      .ilike('nombre_archivo', `%${query}%`)
      .limit(10)
    if (proyecto_id) nombreQuery = nombreQuery.eq('proyecto_id', proyecto_id)
    const { data: resultadosNombre } = await nombreQuery

    // 2. Búsqueda semántica (solo si los docs tienen embeddings generados)
    type ResultadoSemantico = {
      id: string
      proyecto_id: string
      nombre_archivo: string
      resumen_ejecutivo: string | null
      clasificacion: unknown
      similitud: number
    }
    let resultadosSemanticos: ResultadoSemantico[] = []
    try {
      const queryEmbedding = await generarEmbedding(query, 'query')
      const { data } = await admin.rpc('buscar_documentos_semantico', {
        query_embedding: queryEmbedding,
        filtro_proyecto_id: proyecto_id ?? null,
        limite: 10,
      })
      resultadosSemanticos = data ?? []
    } catch {
      // Sin embeddings disponibles: solo búsqueda por nombre
    }

    // Combinar: nombre primero, luego semánticos que no estén ya incluidos
    const idsNombre = new Set((resultadosNombre ?? []).map((r: { id: string }) => r.id))
    const soloSemanticos = resultadosSemanticos.filter(r => !idsNombre.has(r.id))

    const resultados = [
      ...(resultadosNombre ?? []).map((r: { id: string; proyecto_id: string; nombre_archivo: string; resumen_ejecutivo: string | null; clasificacion: unknown; estado_procesamiento: string }) => ({
        ...r, similitud: 1, tipo_match: 'nombre' as const,
      })),
      ...soloSemanticos.map(r => ({ ...r, tipo_match: 'semantico' as const })),
    ]

    return NextResponse.json({ ok: true, resultados })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[buscar] Error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

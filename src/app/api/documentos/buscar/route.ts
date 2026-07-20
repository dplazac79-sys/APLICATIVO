import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generarEmbedding } from '@/lib/ai/embeddings'
import { assertProyectoAccess } from '@/lib/auth/tenant'
import { errorResponse } from '@/lib/api/error-response'
import { verificarLimiteIA, registrarUsoIA } from '@/lib/ai/rate-limit'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const { query, proyecto_id } = await req.json()
    if (!query || typeof query !== 'string' || query.trim().length < 3) {
      return NextResponse.json({ error: 'Escribe al menos 3 caracteres para buscar' }, { status: 400 })
    }

    // El buscador usa el cliente admin (bypassa RLS) para poder combinar
    // resultados por nombre + semánticos en un solo round-trip — por eso
    // proyecto_id es obligatorio acá y se verifica explícitamente el acceso,
    // en vez de confiar en que RLS filtre lo que el usuario puede ver.
    if (!proyecto_id || typeof proyecto_id !== 'string') {
      return NextResponse.json({ error: 'Selecciona un proyecto para buscar' }, { status: 400 })
    }
    if (!(await assertProyectoAccess(user.id, proyecto_id))) {
      return NextResponse.json({ error: 'Sin acceso a este proyecto' }, { status: 403 })
    }

    const admin = createAdminClient()

    // 1. Búsqueda por nombre — insensible a tildes y mayúsculas via unaccent
    const { data: resultadosNombre } = await admin.rpc('buscar_documentos_por_nombre', {
      termino: query,
      filtro_proyecto_id: proyecto_id ?? null,
      limite: 10,
    })

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
    // La búsqueda semántica llama a un proveedor de embeddings externo (costo
    // por llamada) y no tenía ningún límite — un loop de búsquedas podía
    // generar gasto/llamadas ilimitadas. Si se agota el límite mensual, se
    // degrada a solo-nombre en vez de bloquear la búsqueda completa.
    const limite = await verificarLimiteIA(proyecto_id, 'embedding')
    if (limite.permitido) {
      try {
        const queryEmbedding = await generarEmbedding(query, 'query')
        const { data } = await admin.rpc('buscar_documentos_semantico', {
          query_embedding: queryEmbedding,
          filtro_proyecto_id: proyecto_id ?? null,
          limite: 10,
        })
        resultadosSemanticos = data ?? []
        await registrarUsoIA({ proyecto_id, usuario_id: user.id, tipo: 'embedding' }).catch(() => {})
      } catch (err) {
        // No bloquear la búsqueda por nombre si la semántica falla — pero visible en logs,
        // nunca en silencio (así se pierde de vista un fallo sistémico de embeddings).
        console.error('[buscar-semantico] Falló la búsqueda semántica, usando solo nombre:', err instanceof Error ? err.message : err)
      }
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
    return errorResponse(err, 500)
  }
}

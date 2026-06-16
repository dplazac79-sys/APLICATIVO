import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import { createAdminClient } from '@/lib/supabase/admin'
import { generarEmbedding } from '@/lib/ai/embeddings'

const hasCredenciales = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY

beforeAll(() => {
  if (!hasCredenciales) throw new Error('Credenciales de Supabase requeridas para este test')
  if (!process.env.VOYAGE_API_KEY) throw new Error('VOYAGE_API_KEY requerida para este test')
})

const FIXTURES = [
  { archivo: 'retail.txt', nombre: 'retail.txt' },
  { archivo: 'salud.txt', nombre: 'salud.txt' },
  { archivo: 'banca.txt', nombre: 'banca.txt' },
]

// Consultas con su documento esperado como resultado más relevante
const CONSULTAS_DE_PRUEBA = [
  { query: '¿cómo se gestiona la reposición de inventario en las tiendas?', esperado: 'retail.txt' },
  { query: 'reprogramación de cirugías por falta de insumos médicos', esperado: 'salud.txt' },
  { query: 'tiempo de aprobación de créditos para PYMEs', esperado: 'banca.txt' },
  { query: 'rotación de personal y devoluciones de productos en tiendas físicas', esperado: 'retail.txt' },
  { query: 'lista de espera de especialidades médicas y comité de calidad', esperado: 'salud.txt' },
]

describe('Buscador semántico — precisión y latencia (DoD Fase 2)', () => {
  const admin = createAdminClient()
  const sufijo = `search-test-${Date.now()}`
  let clienteId: string
  let proyectoId: string
  const documentoIds: Record<string, string> = {}

  beforeAll(async () => {
    const { data: cliente } = await admin.from('cliente').insert({ razon_social: `Cliente Buscador ${sufijo}` }).select().single()
    clienteId = cliente!.id
    const { data: proyecto } = await admin.from('proyecto').insert({ cliente_id: clienteId, nombre: `Proyecto Buscador ${sufijo}` }).select().single()
    proyectoId = proyecto!.id

    for (const f of FIXTURES) {
      const texto = fs.readFileSync(path.join(process.cwd(), 'tests/fixtures', f.archivo), 'utf-8')
      const embedding = await generarEmbedding(texto, 'document')
      const { data: doc } = await admin.from('documento').insert({
        proyecto_id: proyectoId,
        nombre_archivo: f.nombre,
        url_storage: `${proyectoId}/${f.nombre}`,
        estado_procesamiento: 'listo',
        resumen_ejecutivo: texto.slice(0, 500),
        embedding_ref: embedding,
      }).select().single()
      documentoIds[f.nombre] = doc!.id
    }
  }, 120000)

  afterAll(async () => {
    try {
      await admin.from('documento').delete().eq('proyecto_id', proyectoId)
      await admin.from('proyecto').delete().eq('id', proyectoId)
      await admin.from('cliente').delete().eq('id', clienteId)
    } catch (err) {
      console.warn('[buscador-semantico.test cleanup] falló (no bloqueante):', err)
    }
  })

  it('retorna >80% de precisión top-1 y responde en menos de 3 segundos', async () => {
    let aciertos = 0
    const tiempos: number[] = []

    for (const { query, esperado } of CONSULTAS_DE_PRUEBA) {
      const inicio = Date.now()
      const queryEmbedding = await generarEmbedding(query, 'query')
      const { data: resultados } = await admin.rpc('buscar_documentos_semantico', {
        query_embedding: queryEmbedding,
        filtro_proyecto_id: proyectoId,
        limite: 3,
      })
      const duracionMs = Date.now() - inicio
      tiempos.push(duracionMs)

      const top1 = resultados?.[0]?.nombre_archivo
      if (top1 === esperado) aciertos++
    }

    const precision = aciertos / CONSULTAS_DE_PRUEBA.length
    const tiempoMaximo = Math.max(...tiempos)

    expect(precision).toBeGreaterThanOrEqual(0.8)
    expect(tiempoMaximo).toBeLessThan(3000)
  }, 60000)
})

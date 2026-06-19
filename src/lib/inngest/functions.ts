import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/admin'
import { clasificarDocumento, resumirDocumento, discoveryProcesos } from '@/lib/ai/claude'
import { generarEmbedding } from '@/lib/ai/embeddings'
import { registrarAudit } from '@/lib/audit'
import { verificarLimiteIA, registrarUsoIA } from '@/lib/ai/rate-limit'

// ─── Job 1: Procesar documento ────────────────────────────────────────────────
export const procesarDocumento = inngest.createFunction(
  {
    id: 'procesar-documento',
    name: 'Procesar Documento con IA',
    retries: 2,
    timeouts: { finish: '10m' },
    triggers: [{ event: 'documento/procesar' }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { documento_id, usuario_id } = event.data
    const admin = createAdminClient()

    const doc = await step.run('obtener-documento', async () => {
      const { data, error } = await admin.from('documento').select('*').eq('id', documento_id).single()
      if (error || !data) throw new Error('Documento no encontrado')

      const limite = await verificarLimiteIA(data.proyecto_id, 'clasificar')
      if (!limite.permitido) {
        await admin.from('documento').update({ estado_procesamiento: 'error' }).eq('id', documento_id)
        throw new Error(limite.mensaje)
      }

      await admin.from('documento').update({ estado_procesamiento: 'procesando' }).eq('id', documento_id)
      return data
    })

    const texto = await step.run('extraer-texto', async () => {
      const { data: fileData } = await admin.storage.from('documentos').download(doc.url_storage)
      if (!fileData) throw new Error('No se pudo descargar el archivo')
      const nombre = doc.nombre_archivo.toLowerCase()
      if (nombre.endsWith('.docx') || nombre.endsWith('.doc')) {
        const mammoth = (await import('mammoth')).default
        const buffer = Buffer.from(await fileData.arrayBuffer())
        return (await mammoth.extractRawText({ buffer })).value
      } else if (nombre.endsWith('.pdf')) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfParse = ((await import('pdf-parse')) as any).default ?? (await import('pdf-parse'))
        const buffer = Buffer.from(await fileData.arrayBuffer())
        return (await pdfParse(buffer)).text
      }
      return await fileData.text()
    })

    if (!texto?.trim()) {
      await admin.from('documento').update({ estado_procesamiento: 'error' }).eq('id', documento_id)
      throw new Error('No se pudo extraer texto del documento')
    }

    const [clasificacion, resumen] = await Promise.all([
      step.run('clasificar', () => clasificarDocumento(texto)),
      step.run('resumir', () => resumirDocumento(texto)),
    ])

    await step.run('registrar-uso-clasificar', () =>
      registrarUsoIA({ proyecto_id: doc.proyecto_id, usuario_id, tipo: 'clasificar', tokens_input: 2048, tokens_output: 512 })
    )
    await step.run('registrar-uso-resumir', () =>
      registrarUsoIA({ proyecto_id: doc.proyecto_id, usuario_id, tipo: 'resumir', tokens_input: 4000, tokens_output: 2000 })
    )

    const embedding = await step.run('embedding', () =>
      generarEmbedding(texto, 'document').catch(() => null)
    )
    await step.run('registrar-uso-embedding', () =>
      registrarUsoIA({ proyecto_id: doc.proyecto_id, usuario_id, tipo: 'embedding' })
    )

    await step.run('guardar', async () => {
      await admin.from('documento').update({
        clasificacion,
        resumen_ejecutivo: resumen.resumen_ejecutivo ?? null,
        analisis_ia: resumen,
        embedding_ref: embedding,
        estado_procesamiento: 'listo',
      }).eq('id', documento_id)
      await registrarAudit({
        accion: 'UPDATE',
        entidad: 'documento',
        entidad_id: documento_id,
        detalle: { accion_detalle: 'procesado_con_ia', bloque: clasificacion.bloque },
        usuarioId: usuario_id,
      })
    })

    return { ok: true, clasificacion, resumen: resumen.resumen_ejecutivo }
  }
)

// ─── Job 2: Discovery AI ──────────────────────────────────────────────────────
export const discoveryAI = inngest.createFunction(
  {
    id: 'discovery-procesos',
    name: 'Discovery AI — Detección de Procesos',
    retries: 1,
    timeouts: { finish: '15m' },
    triggers: [{ event: 'proyecto/discovery' }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { proyecto_id, usuario_id } = event.data
    const admin = createAdminClient()

    const { proyecto, documentos } = await step.run('cargar-datos', async () => {
      const { data: proyecto } = await admin.from('proyecto').select('*, cliente(*)').eq('id', proyecto_id).single()
      if (!proyecto) throw new Error('Proyecto no encontrado')

      const limite = await verificarLimiteIA(proyecto_id, 'discovery')
      if (!limite.permitido) throw new Error(limite.mensaje)

      const { data: documentos } = await admin
        .from('documento')
        .select('id, nombre_archivo, resumen_ejecutivo, clasificacion')
        .eq('proyecto_id', proyecto_id)
        .eq('estado_procesamiento', 'listo')
      if (!documentos?.length) throw new Error('No hay documentos procesados')
      return { proyecto, documentos }
    })

    const resultado = await step.run('ejecutar-discovery', async () => {
      const cliente = proyecto.cliente as Record<string, unknown>
      const contexto = `Empresa: ${cliente?.razon_social ?? 'N/A'}\nIndustria: ${cliente?.industria ?? 'N/A'}\nTamaño: ${cliente?.tamano ?? 'N/A'}\nObjetivos: ${cliente?.objetivos_estrategicos ?? 'N/A'}`
      const resumenes = documentos.map((d: { nombre_archivo: string; resumen_ejecutivo: string | null }) =>
        `${d.nombre_archivo}\nResumen: ${d.resumen_ejecutivo ?? 'Sin resumen'}`
      )
      return await discoveryProcesos(contexto, resumenes)
    })

    await step.run('guardar-procesos', async () => {
      await admin.from('proceso').delete().eq('proyecto_id', proyecto_id).in('origen', ['detectado', 'propuesta_ia'])
      for (const macro of resultado.macroprocesos) {
        const docOrigen = documentos.find((d: { nombre_archivo: string }) => d.nombre_archivo === macro.documento_referencia)
        const { data: macroRow } = await admin.from('proceso').insert({
          proyecto_id, nombre: macro.nombre, descripcion: macro.descripcion,
          nivel: 0, tipo: 'macroproceso', origen: macro.origen, estado_oferta: 'propuesto',
          documento_origen_id: docOrigen?.id ?? null,
          metadata_ia: { criticidad: macro.criticidad, estado_actual: macro.estado_actual },
        }).select().single()
        if (!macroRow || !macro.procesos.length) continue
        await admin.from('proceso').insert(
          macro.procesos.map((p: Record<string, unknown>, i: number) => ({
            proyecto_id, padre_id: macroRow.id, nombre: p.nombre, descripcion: p.descripcion,
            nivel: 1, tipo: 'proceso', origen: p.origen, estado_oferta: 'propuesto',
            documento_origen_id: documentos.find((d: { nombre_archivo: string }) => d.nombre_archivo === p.documento_referencia)?.id ?? null,
            roles_involucrados: p.roles_involucrados, riesgos_detectados: p.riesgos_si_no_existe_o_falla,
            metadata_ia: { criticidad: p.criticidad, justificacion_ia: p.justificacion_ia },
            orden: i,
          }))
        )
      }
    })

    await step.run('registrar-uso-discovery', () =>
      registrarUsoIA({ proyecto_id, usuario_id, tipo: 'discovery', tokens_input: 8000, tokens_output: 4000 })
    )

    await step.run('guardar-resumen', async () => {
      await admin.from('proyecto').update({ discovery_resumen: resultado }).eq('id', proyecto_id)
      await registrarAudit({
        accion: 'CREATE', entidad: 'proceso', entidad_id: proyecto_id,
        detalle: { accion_detalle: 'discovery_ai_generado', total_macroprocesos: resultado.macroprocesos.length },
        usuarioId: usuario_id,
      })
    })

    return { ok: true, macroprocesos: resultado.macroprocesos.length }
  }
)

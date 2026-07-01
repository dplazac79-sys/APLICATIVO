import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/admin'
import { analizarDocumento, discoveryProcesos, enriquecerProcesoCliente, analizarGlosarioRoles, RolProceso, PersonaOrg } from '@/lib/ai/claude'
import { buildProyectoContext } from '@/lib/ai/context'
import { generarEmbedding, generarEmbeddingsBatch } from '@/lib/ai/embeddings'
import { chunkearTexto } from '@/lib/ai/chunker'
import { registrarAudit } from '@/lib/audit'
import { verificarLimiteIA, registrarUsoIA } from '@/lib/ai/rate-limit'
import { extraerTextoPDF, extraerTextoDOCX } from '@/lib/extract-text'

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
      const buffer = Buffer.from(await fileData.arrayBuffer())
      if (nombre.endsWith('.docx') || nombre.endsWith('.doc')) {
        return await extraerTextoDOCX(buffer)
      } else if (nombre.endsWith('.pdf')) {
        return await extraerTextoPDF(buffer)
      }
      return await fileData.text()
    })

    if (!texto?.trim()) {
      await admin.from('documento').update({ estado_procesamiento: 'error' }).eq('id', documento_id)
      throw new Error('No se pudo extraer texto del documento')
    }

    // Una sola llamada a Anthropic con prompt caching — reemplaza clasificar + resumir
    const { clasificacion, analisis: resumen } = await step.run('analizar', () => analizarDocumento(texto))

    await step.run('registrar-uso-analisis', () =>
      registrarUsoIA({ proyecto_id: doc.proyecto_id, usuario_id, tipo: 'resumir', tokens_input: 4500, tokens_output: 3000 })
    )

    // Embedding del documento completo (para búsqueda por doc) + chunking para RAG preciso
    const { embedding, chunks } = await step.run('embedding-y-chunks', async () => {
      const chunks = chunkearTexto(texto)
      // Embedding del documento completo = sobre el resumen ejecutivo (más semántico que texto crudo)
      const textoParaEmbedding = resumen.resumen_ejecutivo
        ? `${resumen.resumen_ejecutivo}\n\n${resumen.diagnostico_operacional ?? ''}\n\n${(resumen.hallazgos_criticos ?? []).join(' ')}`
        : texto.slice(0, 4000)
      const embedding = await generarEmbedding(textoParaEmbedding, 'document').catch(() => null)
      return { embedding, chunks }
    })

    await step.run('guardar-documento', async () => {
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

    // Guardar chunks con embeddings en batch (voyage-3 acepta hasta 128 a la vez)
    await step.run('guardar-chunks', async () => {
      if (!chunks.length) return
      // Borrar chunks previos del documento (si se re-procesa)
      await admin.from('documento_chunk').delete().eq('documento_id', documento_id)
      // Generar embeddings en batch para todos los chunks
      const textos = chunks.map((c: { texto: string }) => c.texto)
      const embeddings = await generarEmbeddingsBatch(textos, 'document').catch(() => null)
      const rows = chunks.map((c: { indice: number; titulo: string | null; texto: string; tokens_est: number }, i: number) => ({
        documento_id,
        proyecto_id: doc.proyecto_id,
        indice: c.indice,
        titulo: c.titulo,
        texto: c.texto,
        tokens_est: c.tokens_est,
        embedding: embeddings?.[i] ?? null,
      }))
      // Insertar en lotes de 50 para no exceder el límite de Supabase
      for (let i = 0; i < rows.length; i += 50) {
        await admin.from('documento_chunk').insert(rows.slice(i, i + 50))
      }
    })

    await step.run('registrar-uso-embedding', () =>
      registrarUsoIA({ proyecto_id: doc.proyecto_id, usuario_id, tipo: 'embedding' })
    )

    return { ok: true, clasificacion, resumen: resumen.resumen_ejecutivo, total_chunks: chunks.length }
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
    const { proyecto_id, usuario_id, documento_ids, job_id } = event.data
    const admin = createAdminClient()

    // Si la función falla en cualquier paso, marcar el job como error
    const marcarError = async (mensaje: string) => {
      if (!job_id) return
      await admin.from('jobs').update({ estado: 'error', error_mensaje: mensaje }).eq('id', job_id)
    }

    const datos = await step.run('cargar-datos', async () => {
      const limite = await verificarLimiteIA(proyecto_id, 'discovery')
      if (!limite.permitido) throw new Error(limite.mensaje)

      // Context manager: lee resúmenes y analisis_ia desde DB — no re-procesa archivos
      const ctx = await buildProyectoContext(proyecto_id)
      if (!ctx.documentos_resumenes.length) throw new Error('No hay documentos procesados')

      // Filtrar por documento_ids si se especificaron
      const documentos_filtrados = Array.isArray(documento_ids) && documento_ids.length > 0
        ? ctx.documentos_resumenes.slice(0, documento_ids.length) // aproximación — ya están en DB
        : ctx.documentos_resumenes

      // Obtener doc IDs para guardar referencias
      let query = admin
        .from('documento')
        .select('id, nombre_archivo')
        .eq('proyecto_id', proyecto_id)
        .eq('estado_procesamiento', 'listo')
      if (Array.isArray(documento_ids) && documento_ids.length > 0) {
        query = query.in('id', documento_ids)
      }
      const { data: documentos } = await query
      if (!documentos?.length) throw new Error('No hay documentos procesados')

      return { ctx, documentos_filtrados, documentos }
    })

    const resultado = await step.run('ejecutar-discovery', async () => {
      try {
        return await discoveryProcesos(datos.ctx.empresa, datos.ctx.documentos_filtrados)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error en análisis IA'
        await marcarError(msg)
        throw err
      }
    })

    await step.run('guardar-procesos', async () => {
      await admin.from('proceso').delete().eq('proyecto_id', proyecto_id).in('origen', ['detectado', 'propuesta_ia'])
      for (const macro of resultado.macroprocesos) {
        const docs = datos.documentos
        const docOrigen = docs.find((d: { nombre_archivo: string }) => d.nombre_archivo === macro.documento_referencia)
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
            documento_origen_id: docs.find((d: { nombre_archivo: string }) => d.nombre_archivo === p.documento_referencia)?.id ?? null,
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

    await step.run('marcar-job-listo', async () => {
      if (!job_id) return
      await admin.from('jobs').update({ estado: 'listo' }).eq('id', job_id)
    })

    return { ok: true, macroprocesos: resultado.macroprocesos.length }
  }
)

// ─── Job 3: Enriquecer documento del cliente ──────────────────────────────────
export const enriquecerDocumentoCliente = inngest.createFunction(
  {
    id: 'enriquecer-documento-cliente',
    name: 'Journey Cliente — Enriquecimiento IA de Proceso',
    retries: 2,
    timeouts: { finish: '10m' },
    triggers: [{ event: 'portal/enriquecer-documento' }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { documento_cliente_id, proyecto_id, usuario_id } = event.data
    const admin = createAdminClient()

    // 1. Marcar como procesando
    await step.run('marcar-procesando', async () => {
      await admin.from('documento_cliente')
        .update({ estado: 'procesando' })
        .eq('id', documento_cliente_id)
    })

    // 2. Descargar y extraer texto del documento del cliente
    const texto = await step.run('extraer-texto', async () => {
      const { data: doc } = await admin.from('documento_cliente')
        .select('url_storage, nombre_archivo')
        .eq('id', documento_cliente_id)
        .single()
      if (!doc) throw new Error('Documento cliente no encontrado')

      const { data: fileData } = await admin.storage.from('documentos-cliente').download(doc.url_storage)
      if (!fileData) throw new Error('No se pudo descargar el archivo del cliente')

      const nombre = doc.nombre_archivo.toLowerCase()
      const buffer = Buffer.from(await fileData.arrayBuffer())
      if (nombre.endsWith('.docx') || nombre.endsWith('.doc')) {
        return await extraerTextoDOCX(buffer)
      } else if (nombre.endsWith('.pdf')) {
        return await extraerTextoPDF(buffer)
      }
      return await fileData.text()
    })

    if (!texto?.trim()) {
      await admin.from('documento_cliente').update({ estado: 'error', error_mensaje: 'No se pudo extraer texto del documento' }).eq('id', documento_cliente_id)
      throw new Error('Sin texto extraíble')
    }

    // 3. Obtener contexto del proyecto (documentos internos + discovery)
    const contextoProyecto = await step.run('obtener-contexto', async () => {
      const { data: proyecto } = await admin.from('proyecto')
        .select('nombre, alcance, cliente(razon_social, industria, objetivos_estrategicos)')
        .eq('id', proyecto_id)
        .single()

      const { data: docs } = await admin.from('documento')
        .select('nombre_archivo, resumen_ejecutivo')
        .eq('proyecto_id', proyecto_id)
        .eq('estado_procesamiento', 'listo')
        .limit(5)

      const { data: procesos } = await admin.from('proceso')
        .select('nombre, descripcion, nivel')
        .eq('proyecto_id', proyecto_id)
        .eq('estado_oferta', 'aceptado')
        .limit(20)

      const cliente = (proyecto?.cliente as unknown as Record<string, string>) ?? {}
      let ctx = `Empresa: ${cliente.razon_social ?? 'N/A'}\nIndustria: ${cliente.industria ?? 'N/A'}\nProyecto: ${proyecto?.nombre ?? 'N/A'}\nAlcance: ${proyecto?.alcance ?? 'N/A'}\nObjetivos: ${cliente.objetivos_estrategicos ?? 'N/A'}\n`

      if (docs?.length) {
        ctx += '\nDocumentos del proyecto:\n' + docs.map(d => `- ${d.nombre_archivo}: ${d.resumen_ejecutivo ?? 'Sin resumen'}`).join('\n')
      }
      if (procesos?.length) {
        ctx += '\nInventario de procesos identificados:\n' + procesos.map(p => `- [Nivel ${p.nivel}] ${p.nombre}: ${p.descripcion ?? ''}`).join('\n')
      }
      return ctx
    })

    // 4. Llamar a Claude para enriquecer
    const enriquecido = await step.run('enriquecer-con-ia', () =>
      enriquecerProcesoCliente(texto, contextoProyecto)
    )

    await step.run('registrar-uso', () =>
      registrarUsoIA({ proyecto_id, usuario_id, tipo: 'resumir', tokens_input: 6000, tokens_output: 2000 })
    )

    // 5. Guardar resultado
    await step.run('guardar-resultado', async () => {
      await admin.from('proceso_enriquecido').insert({
        documento_cliente_id,
        proyecto_id,
        nombre_proceso: enriquecido.nombre_proceso,
        macroproceso: enriquecido.macroproceso,
        numero_en_macroproceso: enriquecido.numero_en_macroproceso,
        total_en_macroproceso: enriquecido.total_en_macroproceso,
        descripcion: enriquecido.descripcion,
        sin_proceso_riesgos: enriquecido.sin_proceso_riesgos,
        con_proceso_beneficios: enriquecido.con_proceso_beneficios,
        valor_negocio: enriquecido.valor_negocio,
        actores: enriquecido.actores,
        sistemas: enriquecido.sistemas,
        kpis: enriquecido.kpis,
        riesgos: enriquecido.riesgos,
        contenido_editado: {
          descripcion: enriquecido.descripcion,
          sin_proceso_riesgos: enriquecido.sin_proceso_riesgos,
          con_proceso_beneficios: enriquecido.con_proceso_beneficios,
        },
      })
      await admin.from('documento_cliente').update({ estado: 'enriquecido' }).eq('id', documento_cliente_id)
    })

    return { ok: true, proceso: enriquecido.nombre_proceso }
  }
)

// ─── Job 4: Analizar Glosario de Roles ───────────────────────────────────────
export const analizarGlosarioRolesJob = inngest.createFunction(
  {
    id: 'analizar-glosario-roles',
    name: 'Glosario de Roles — Análisis IA',
    retries: 2,
    timeouts: { finish: '15m' },
    triggers: [{ event: 'portal/analizar-glosario-roles' }],
  },
  async ({ event, step }: any) => {
    const { analisis_id, proyecto_id } = event.data
    const admin = createAdminClient()

    await step.run('marcar-procesando', async () => {
      await admin.from('glosario_roles_analisis').update({ estado: 'generando' }).eq('id', analisis_id)
    })

    // Cargar todos los datos necesarios en un solo step
    const contexto = await step.run('cargar-contexto', async () => {
      const { data: analisis } = await admin.from('glosario_roles_analisis')
        .select('organigrama_id, roles_en_procesos').eq('id', analisis_id).single()
      const { data: org } = await admin.from('organigrama_cliente')
        .select('texto_extraido').eq('id', analisis?.organigrama_id ?? '').single()
      const { data: cvs } = await admin.from('cv_persona_org')
        .select('nombre_persona, cargo_actual, texto_cv').eq('proyecto_id', proyecto_id)
      const { data: proy } = await admin.from('proyecto')
        .select('nombre, cliente(razon_social, industria)').eq('id', proyecto_id).single()
      const clienteRaw = proy?.cliente
      const cliente = (Array.isArray(clienteRaw) ? clienteRaw[0] : clienteRaw) as { razon_social?: string; industria?: string } | null
      return {
        roles: (analisis?.roles_en_procesos ?? []) as RolProceso[],
        textoOrganigrama: org?.texto_extraido ?? '',
        personas: (cvs ?? []).map(c => ({ nombre: c.nombre_persona, cargo: c.cargo_actual ?? '', skills: c.texto_cv ?? '' })) as PersonaOrg[],
        nombreEmpresa: cliente?.razon_social ?? 'Empresa cliente',
        industria: cliente?.industria ?? 'No especificada',
        nombreProyecto: proy?.nombre ?? '',
      }
    })

    const resultadoFinal = await step.run('analizar-con-ia', async () => {
      return analizarGlosarioRoles({
        rolesEnProcesos: contexto.roles,
        textoOrganigrama: contexto.textoOrganigrama,
        personas: contexto.personas,
        nombreEmpresa: contexto.nombreEmpresa,
        industria: contexto.industria,
        contextoProcesos: `Proyecto: ${contexto.nombreProyecto}`,
      })
    })

    await step.run('guardar-resultado', async () => {
      const mapeos = resultadoFinal.mapeos ?? []
      await admin.from('glosario_roles_analisis').update({
        estado: 'completado',
        mapeos,
        resumen_ejecutivo: resultadoFinal.resumen_ejecutivo,
        total_mapeados:      mapeos.filter((m: any) => m.tipo === 'mapeo_directo').length,
        total_equivalencias: mapeos.filter((m: any) => m.tipo === 'equivalencia').length,
        total_crear_cargo:   mapeos.filter((m: any) => m.tipo === 'crear_cargo').length,
      }).eq('id', analisis_id)
    })

    return { analisis_id, total: resultadoFinal.mapeos?.length ?? 0 }
  }
)

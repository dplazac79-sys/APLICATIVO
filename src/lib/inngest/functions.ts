import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

interface StepTools {
  run: <T>(name: string, fn: () => Promise<T> | T) => Promise<T>
}
import { analizarDocumento, discoveryProcesos, enriquecerProcesoCliente, analizarGlosarioRoles, RolProceso, PersonaOrg } from '@/lib/ai/claude'
import { buildProyectoContext } from '@/lib/ai/context'
import { generarEmbedding } from '@/lib/ai/embeddings'
import { registrarAudit } from '@/lib/audit'
import { verificarLimiteIA, registrarUsoIA } from '@/lib/ai/rate-limit'
import { extraerTextoPDF, extraerTextoDOCX, extraerMacroprocesoDeTexto } from '@/lib/extract-text'

// ─── Job 1: Procesar documento ────────────────────────────────────────────────
export const procesarDocumento = inngest.createFunction(
  {
    id: 'procesar-documento',
    name: 'Procesar Documento con IA',
    retries: 2,
    timeouts: { finish: '10m' },
    triggers: [{ event: 'documento/procesar' }],
  },
  async ({ event, step }: { event: { data: { documento_id: string; usuario_id: string } }; step: StepTools }) => {
    const { documento_id, usuario_id } = event.data
    const admin = createAdminClient()

    try {
      return await procesarDocumentoBody({ documento_id, usuario_id, admin, step })
    } catch (err) {
      // Si el job falla tras agotar reintentos (o lanza en un paso sin manejo propio),
      // el documento no debe quedar "procesando" para siempre — sin esto, la UI nunca
      // muestra el fallo y el usuario no tiene forma de saber que debe reintentar.
      console.error(`[procesar-documento] Falló job para documento_id=${documento_id}:`, err instanceof Error ? err.message : err)
      await admin.from('documento').update({ estado_procesamiento: 'error' }).eq('id', documento_id)
      throw err
    }
  }
)

async function procesarDocumentoBody({ documento_id, usuario_id, admin, step }: {
  documento_id: string
  usuario_id: string
  admin: AdminClient
  step: StepTools
}) {
  {
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

    // Embedding del documento completo (para búsqueda por doc, buscar_documentos_semantico).
    // El chunking a nivel de fragmento (RAG preciso) se generaba y guardaba
    // (con su propio costo de embeddings) pero buscar_chunks_semantico() —
    // la función pensada para consultarlo — nunca se conectó a ningún
    // endpoint. Se dejó de generar (hallazgo de auditoría analítica de BD,
    // decisión: no seguir gastando presupuesto de IA en algo que nadie
    // consulta; retomar el chunking si se decide terminar esa feature).
    const embedding = await step.run('embedding-documento', async () => {
      // Embedding del documento completo = sobre el resumen ejecutivo (más semántico que texto crudo)
      const textoParaEmbedding = resumen.resumen_ejecutivo
        ? `${resumen.resumen_ejecutivo}\n\n${resumen.diagnostico_operacional ?? ''}\n\n${(resumen.hallazgos_criticos ?? []).join(' ')}`
        : texto.slice(0, 4000)
      return await generarEmbedding(textoParaEmbedding, 'document').catch(err => {
        // No bloquear el procesamiento del documento si falla el embedding — pero
        // NUNCA en silencio: esto rompe la búsqueda semántica sin dejar rastro.
        console.error(`[embedding] Falló generarEmbedding para documento_id=${documento_id}:`, err instanceof Error ? err.message : err)
        return null
      })
    })

    await step.run('guardar-documento', async () => {
      await admin.from('documento').update({
        clasificacion,
        resumen_ejecutivo: resumen.resumen_ejecutivo ?? null,
        analisis_ia: resumen,
        embedding_ref: embedding,
        estado_procesamiento: 'listo',
        macroproceso: extraerMacroprocesoDeTexto(texto),
      }).eq('id', documento_id)

      // Sincronizar roles reales del RACI al proceso que originó este documento
      const rolesIA = (resumen.roles_y_responsabilidades?.roles_identificados ?? []) as string[]
      if (rolesIA.length > 0) {
        // Extraer nombre corto: antes del primer '—' o '-'
        const rolesCortos = rolesIA.map((r: string) => r.split(/\s*[—\-–]\s*/)[0].trim())
        await admin.from('proceso')
          .update({ roles_involucrados: rolesCortos })
          .eq('documento_origen_id', documento_id)
      }

      await registrarAudit({
        accion: 'UPDATE',
        entidad: 'documento',
        entidad_id: documento_id,
        detalle: { accion_detalle: 'procesado_con_ia', bloque: clasificacion.bloque },
        usuarioId: usuario_id,
      })
    })

    await step.run('registrar-uso-embedding', () =>
      registrarUsoIA({ proyecto_id: doc.proyecto_id, usuario_id, tipo: 'embedding' })
    )

    return { ok: true, clasificacion, resumen: resumen.resumen_ejecutivo }
  }
}

// ─── Job 2: Discovery AI ──────────────────────────────────────────────────────
export const discoveryAI = inngest.createFunction(
  {
    id: 'discovery-procesos',
    name: 'Discovery AI — Detección de Procesos',
    retries: 1,
    timeouts: { finish: '15m' },
    triggers: [{ event: 'proyecto/discovery' }],
  },
  async ({ event, step }: { event: { data: { proyecto_id: string; usuario_id: string; documento_ids?: string[]; job_id?: string } }; step: StepTools }) => {
    const { proyecto_id, usuario_id, documento_ids, job_id } = event.data
    const admin = createAdminClient()

    // Si la función falla en cualquier paso, marcar el job como error
    const marcarError = async (mensaje: string) => {
      if (!job_id) return
      await admin.from('jobs').update({ estado: 'error', error_mensaje: mensaje }).eq('id', job_id)
    }

    try {
      return await discoveryAIBody({ proyecto_id, usuario_id, documento_ids, job_id, admin, step, marcarError })
    } catch (err) {
      // Antes solo 'ejecutar-discovery' marcaba error — un fallo en cualquier otro
      // paso (cargar-datos, guardar-procesos) dejaba jobs.estado sin actualizar
      // para siempre, sin señal visible para el usuario.
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      console.error(`[discovery-procesos] Falló job para proyecto_id=${proyecto_id}:`, msg)
      await marcarError(msg)
      throw err
    }
  }
)

async function discoveryAIBody({ proyecto_id, usuario_id, documento_ids, job_id, admin, step, marcarError }: {
  proyecto_id: string
  usuario_id: string
  documento_ids?: string[]
  job_id?: string
  admin: AdminClient
  step: StepTools
  marcarError: (mensaje: string) => Promise<void>
}) {
  {
    const datos = await step.run('cargar-datos', async () => {
      const limite = await verificarLimiteIA(proyecto_id, 'discovery')
      if (!limite.permitido) throw new Error(limite.mensaje)

      // Context manager: filtra por documento_ids si se especificaron, con límite de 10
      const ctx = await buildProyectoContext(proyecto_id, documento_ids)
      if (!ctx.documentos_resumenes.length) throw new Error('No hay documentos procesados')

      // Obtener doc IDs para guardar referencias (misma lógica de filtro)
      let query = admin
        .from('documento')
        .select('id, nombre_archivo')
        .eq('proyecto_id', proyecto_id)
        .eq('estado_procesamiento', 'listo')
        .limit(10)
      if (Array.isArray(documento_ids) && documento_ids.length > 0) {
        query = query.in('id', documento_ids)
      }
      const { data: documentos } = await query
      if (!documentos?.length) throw new Error('No hay documentos procesados')

      return { ctx, documentos_filtrados: ctx.documentos_resumenes, documentos }
    })

    const resultado = await step.run('ejecutar-discovery', async () => {
      try {
        return await discoveryProcesos(datos.ctx.empresa, datos.documentos_filtrados)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error en análisis IA'
        await marcarError(msg)
        throw err
      }
    })

    await step.run('guardar-procesos', async () => {
      // Solo se reemplazan los procesos que nadie ha revisado todavía
      // (estado_oferta='propuesto'). Un proceso ya aceptado o rechazado es
      // una decisión humana tomada — y si fue aceptado, puede tener
      // artefactos ya validados por el cliente (artefacto.proceso_id tiene
      // ON DELETE CASCADE). El macroproceso (nivel 0) YA NO se borra ni se
      // recrea en cada corrida: se reutiliza por nombre (case-insensitive)
      // en vez de duplicar.
      await admin.from('proceso').delete()
        .eq('proyecto_id', proyecto_id)
        .eq('nivel', 1)
        .in('origen', ['detectado', 'propuesta_ia'])
        .eq('estado_oferta', 'propuesto')

      // Procesos nivel 1 ya decididos (aceptado o rechazado) por documento
      // origen — el borrado de arriba solo limpia los "propuesto", así que
      // si el cliente ya aceptó/rechazó el proceso de un documento y
      // Discovery se vuelve a ejecutar, la IA vuelve a proponer ese mismo
      // documento y, sin este filtro, se insertaba un duplicado "propuesto"
      // al lado del proceso ya decidido (mismo documento_origen_id, mismo
      // código, dos filas). Se filtra por documento_origen_id porque es la
      // señal estable — el nombre puede variar levemente entre corridas.
      const { data: decididosExistentes } = await admin.from('proceso')
        .select('documento_origen_id')
        .eq('proyecto_id', proyecto_id)
        .eq('nivel', 1)
        .in('estado_oferta', ['aceptado', 'rechazado'])
        .not('documento_origen_id', 'is', null)
      const docsYaDecididos = new Set((decididosExistentes ?? []).map(p => p.documento_origen_id))

      const { data: macrosExistentes } = await admin.from('proceso')
        .select('id, nombre')
        .eq('proyecto_id', proyecto_id)
        .eq('nivel', 0)

      const docs = datos.documentos

      // El macroproceso NUNCA se toma de lo que agrupó la IA — se toma del
      // campo `documento.macroproceso`, extraído por regex de la carátula
      // real del archivo al procesarlo (ver extraerMacroprocesoDeTexto en
      // extract-text.ts). Esto evita depender de que el modelo lea bien un
      // resumen ejecutivo truncado y evita que "adivine" un área de negocio
      // distinta a la que el propio documento declara. Se aplana la
      // respuesta de la IA (todos sus procesos, sin importar bajo qué
      // macroproceso los agrupó) y se reagrupa acá con la fuente de verdad.
      const todosLosProcesos = resultado.macroprocesos.flatMap(m => m.procesos ?? [])

      // Fallback: si algún doc no tiene macroproceso detectado en su
      // carátula, usamos lo que diga la IA para ese proceso puntual (mejor
      // que nada) antes de caer al texto genérico.
      const macroFallback = new Map(
        resultado.macroprocesos.flatMap(m => (m.procesos ?? []).map(p => [p.documento_referencia, m] as const))
      )

      const grupos = new Map<string, Array<Record<string, unknown>>>()
      for (const p of todosLosProcesos as Array<Record<string, unknown>>) {
        const docRef = p.documento_referencia as string | null
        const docOrigen = docs.find((d: { nombre_archivo: string }) => d.nombre_archivo === docRef)
        const nombreMacro = datos.ctx.macroprocesos_por_documento[docRef ?? '']
          ?? macroFallback.get(docRef ?? '')?.nombre
          ?? 'Sin macroproceso identificado'
        const key = nombreMacro.trim().toLowerCase()
        if (!grupos.has(key)) grupos.set(key, [])
        grupos.get(key)!.push({ ...p, __nombre_macro: nombreMacro, __doc_origen: docOrigen })
      }

      let i = 0
      for (const [, procesosDelGrupo] of Array.from(grupos.entries())) {
        const nombreMacro = procesosDelGrupo[0].__nombre_macro as string
        const infoIA = macroFallback.get(procesosDelGrupo[0].documento_referencia as string)

        const existente = macrosExistentes?.find(
          m => m.nombre.trim().toLowerCase() === nombreMacro.trim().toLowerCase()
        )
        let macroRow: { id: string } | null = existente ?? null
        if (!macroRow) {
          const { data: nuevo } = await admin.from('proceso').insert({
            proyecto_id, nombre: nombreMacro, descripcion: infoIA?.descripcion ?? '',
            nivel: 0, tipo: 'macroproceso', origen: 'detectado', estado_oferta: 'propuesto',
            documento_origen_id: (procesosDelGrupo[0].__doc_origen as { id: string } | undefined)?.id ?? null,
            metadata_ia: { criticidad: infoIA?.criticidad ?? 'media', estado_actual: infoIA?.estado_actual ?? null },
          }).select('id').single()
          macroRow = nuevo
          if (macroRow) macrosExistentes?.push({ id: macroRow.id, nombre: nombreMacro })
        }
        if (!macroRow) continue

        // No reproponer un proceso cuyo documento origen ya tiene una
        // decisión humana tomada (aceptado o rechazado) — ver comentario
        // junto a docsYaDecididos más arriba.
        const procesosAInsertar = procesosDelGrupo.filter(p => {
          const docId = (p.__doc_origen as { id: string } | undefined)?.id
          return !docId || !docsYaDecididos.has(docId)
        })
        if (procesosAInsertar.length === 0) continue

        await admin.from('proceso').insert(
          procesosAInsertar.map((p: Record<string, unknown>) => {
            const docRef = p.documento_referencia as string | null
            const codigo = docRef ? docRef.replace(/\.[^.]+$/, '').toUpperCase() : null
            const ordenNum = codigo ? (parseInt(codigo.replace(/\D/g, ''), 10) || ++i) : ++i
            const puntosMejora = Array.isArray(p.puntos_mejora) ? p.puntos_mejora as Array<Record<string, unknown>> : []
            return {
              proyecto_id, padre_id: macroRow!.id, nombre: p.nombre, descripcion: p.descripcion,
              nivel: 1, tipo: 'proceso', origen: 'detectado', estado_oferta: 'propuesto',
              codigo,
              documento_origen_id: (p.__doc_origen as { id: string } | undefined)?.id ?? null,
              roles_involucrados: p.roles_involucrados, riesgos_detectados: p.riesgos_si_no_existe_o_falla,
              metadata_ia: {
                criticidad: p.criticidad,
                evidencia_documento: p.evidencia_documento ?? null,
                documento_referencia: docRef,
                kpis_recomendados: p.kpis_recomendados ?? [],
                benchmark_industria: p.benchmark_industria ?? null,
                puntos_mejora: puntosMejora.map((pm) => ({
                  id: crypto.randomUUID(),
                  texto: pm.texto,
                  categoria: pm.categoria ?? null,
                  justificacion: pm.justificacion ?? null,
                  estado: 'propuesto',
                })),
              },
              orden: ordenNum,
            }
          })
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
}

// ─── Job 3: Enriquecer documento del cliente ──────────────────────────────────
export const enriquecerDocumentoCliente = inngest.createFunction(
  {
    id: 'enriquecer-documento-cliente',
    name: 'Journey Cliente — Enriquecimiento IA de Proceso',
    retries: 2,
    timeouts: { finish: '10m' },
    triggers: [{ event: 'portal/enriquecer-documento' }],
  },
  async ({ event, step }: { event: { data: { documento_cliente_id: string; proyecto_id: string; usuario_id: string } }; step: StepTools }) => {
    const { documento_cliente_id, proyecto_id, usuario_id } = event.data
    const admin = createAdminClient()

    try {
      return await enriquecerDocumentoClienteBody({ documento_cliente_id, proyecto_id, usuario_id, admin, step })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      console.error(`[enriquecer-documento-cliente] Falló job para documento_cliente_id=${documento_cliente_id}:`, msg)
      await admin.from('documento_cliente').update({ estado: 'error', error_mensaje: msg }).eq('id', documento_cliente_id)
      throw err
    }
  }
)

async function enriquecerDocumentoClienteBody({ documento_cliente_id, proyecto_id, usuario_id, admin, step }: {
  documento_cliente_id: string
  proyecto_id: string
  usuario_id: string
  admin: AdminClient
  step: StepTools
}) {
  {
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
        ctx += '\nDocumentos del proyecto:\n' + docs.map((d: { nombre_archivo: string; resumen_ejecutivo: string | null }) => `- ${d.nombre_archivo}: ${d.resumen_ejecutivo ?? 'Sin resumen'}`).join('\n')
      }
      if (procesos?.length) {
        ctx += '\nInventario de procesos identificados:\n' + procesos.map((p: { nivel: number; nombre: string; descripcion: string | null }) => `- [Nivel ${p.nivel}] ${p.nombre}: ${p.descripcion ?? ''}`).join('\n')
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

    // 5. Guardar resultado — separado en dos steps: si 'marcar-enriquecido' falla y el
    // job reintenta, Inngest memoiza el resultado de 'guardar-proceso-enriquecido' y NO
    // vuelve a ejecutar el insert (antes ambos vivían en un solo step: un fallo entre el
    // insert y el update duplicaba la fila de proceso_enriquecido en cada reintento).
    await step.run('guardar-proceso-enriquecido', async () => {
      // Calcular posición real en el macroproceso desde BD (nunca dejar que la IA invente esto)
      const { count: totalMacro } = await admin.from('proceso_enriquecido')
        .select('id', { count: 'exact', head: true })
        .eq('proyecto_id', proyecto_id)
        .eq('macroproceso', enriquecido.macroproceso)
      const numeroReal = (totalMacro ?? 0) + 1

      await admin.from('proceso_enriquecido').insert({
        documento_cliente_id,
        proyecto_id,
        nombre_proceso: enriquecido.nombre_proceso,
        macroproceso: enriquecido.macroproceso,
        numero_en_macroproceso: numeroReal,
        total_en_macroproceso: numeroReal,
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
    })

    await step.run('marcar-enriquecido', async () => {
      await admin.from('documento_cliente').update({ estado: 'enriquecido' }).eq('id', documento_cliente_id)
    })

    return { ok: true, proceso: enriquecido.nombre_proceso }
  }
}

// ─── Job 4: Analizar Glosario de Roles ───────────────────────────────────────
export const analizarGlosarioRolesJob = inngest.createFunction(
  {
    id: 'analizar-glosario-roles',
    name: 'Glosario de Roles — Análisis IA',
    retries: 2,
    timeouts: { finish: '15m' },
    triggers: [{ event: 'portal/analizar-glosario-roles' }],
  },
  async ({ event, step }: { event: { data: { analisis_id: string; proyecto_id: string } }; step: StepTools }) => {
    const { analisis_id, proyecto_id } = event.data
    const admin = createAdminClient()

    try {
      return await analizarGlosarioRolesBody({ analisis_id, proyecto_id, admin, step })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      console.error(`[analizar-glosario-roles] Falló job para analisis_id=${analisis_id}:`, msg)
      await admin.from('glosario_roles_analisis').update({ estado: 'error', error_msg: msg }).eq('id', analisis_id)
      throw err
    }
  }
)

async function analizarGlosarioRolesBody({ analisis_id, proyecto_id, admin, step }: {
  analisis_id: string
  proyecto_id: string
  admin: AdminClient
  step: StepTools
}) {
  {
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
        personas: (cvs ?? []).map((c: { nombre_persona: string; cargo_actual: string | null; texto_cv: string | null }) => ({ nombre: c.nombre_persona, cargo: c.cargo_actual ?? '', skills: c.texto_cv ?? '' })) as PersonaOrg[],
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
        resumen_ejecutivo:              resultadoFinal.resumen_ejecutivo,
        score_cobertura_organizacional: resultadoFinal.score_cobertura_organizacional ?? 0,
        alertas_criticas:               resultadoFinal.alertas_criticas ?? [],
        plan_accion_30_dias:            resultadoFinal.plan_accion_30_dias ?? [],
        total_mapeados:      mapeos.filter((m) => m.tipo === 'mapeo_directo').length,
        total_equivalencias: mapeos.filter((m) => m.tipo === 'equivalencia').length,
        total_crear_cargo:   mapeos.filter((m) => m.tipo === 'crear_cargo').length,
      }).eq('id', analisis_id)
    })

    return { analisis_id, total: resultadoFinal.mapeos?.length ?? 0 }
  }
}

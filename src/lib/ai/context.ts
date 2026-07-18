/**
 * Context Manager — construye el contexto óptimo para cada operación de IA
 * Lee desde DB en vez de re-procesar archivos. Nunca re-envía texto crudo.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import type { ContextoProceso, DocumentoResumen } from '@/lib/ai/artefactos'
import type { ResumenDoc } from '@/lib/ai/claude'

interface ClienteResumen {
  razon_social: string | null
  industria: string | null
  tamano: string | null
  objetivos_estrategicos: string | null
}

interface ProyectoResumen {
  nombre: string | null
  alcance: string | null
  cliente: ClienteResumen | null
}

interface DocumentoOrigenResumen {
  nombre_archivo: string
  resumen_ejecutivo: string | null
  analisis_ia: { clasificacion?: unknown; analisis?: ResumenDoc } | null
  clasificacion: Record<string, unknown> | null
  macroproceso: string | null
}

export interface ContextoCompleto {
  proceso: ContextoProceso
  documentos: DocumentoResumen[]
  analisis_ia: Record<string, unknown> | null  // JSONB rico del documento origen
  proyecto_contexto: string                     // string listo para inyectar en prompt
  proceso_contexto: string                      // string listo para inyectar en prompt
}

/**
 * Construye el contexto completo de un proceso desde DB.
 * Prioriza analisis_ia JSONB > resumen_ejecutivo texto > nada.
 * Máximo ~6000 tokens de contexto total.
 */
export async function buildProcesoContext(procesoId: string): Promise<ContextoCompleto> {
  const admin = createAdminClient()

  const { data: proceso } = await admin
    .from('proceso')
    .select(`
      *,
      proyecto:proyecto_id (
        nombre, alcance,
        cliente:cliente_id (razon_social, industria, tamano, objetivos_estrategicos)
      ),
      documento_origen:documento_origen_id (
        nombre_archivo, resumen_ejecutivo, analisis_ia, clasificacion
      )
    `)
    .eq('id', procesoId)
    .single()

  if (!proceso) throw new Error(`Proceso ${procesoId} no encontrado`)

  const proyecto = proceso.proyecto as unknown as ProyectoResumen | null
  const cliente = proyecto?.cliente ?? null
  const docOrigen = proceso.documento_origen as unknown as DocumentoOrigenResumen | null

  // Obtener otros documentos del proyecto (resúmenes ejecutivos solamente — no texto crudo)
  const { data: otrosDocs } = await admin
    .from('documento')
    .select('nombre_archivo, resumen_ejecutivo, clasificacion')
    .eq('proyecto_id', proceso.proyecto_id)
    .eq('estado_procesamiento', 'listo')
    .limit(5)

  const ctx: ContextoProceso = {
    nombre: proceso.nombre,
    descripcion: proceso.descripcion,
    nivel: proceso.nivel,
    origen: proceso.origen,
    roles_involucrados: proceso.roles_involucrados,
    riesgos_detectados: proceso.riesgos_detectados,
    metadata_ia: proceso.metadata_ia,
    proyecto_nombre: proyecto?.nombre ?? 'N/A',
    cliente_razon_social: cliente?.razon_social ?? 'N/A',
    cliente_industria: cliente?.industria ?? null,
  }

  const documentos: DocumentoResumen[] = (otrosDocs ?? []).map(d => ({
    nombre_archivo: d.nombre_archivo,
    resumen_ejecutivo: d.resumen_ejecutivo,
    clasificacion: d.clasificacion,
  }))

  // Extraer insights del analisis_ia JSONB si existe (evita re-enviar texto crudo)
  const analisis_ia = (docOrigen?.analisis_ia ?? null) as Record<string, unknown> | null
  const insightsDeAnalisis = docOrigen?.analisis_ia
    ? buildInsightsFromAnalisis(docOrigen.analisis_ia)
    : docOrigen?.resumen_ejecutivo ?? ''

  const proyecto_contexto = [
    `Empresa: ${cliente?.razon_social ?? 'N/A'}`,
    `Industria: ${cliente?.industria ?? 'N/A'}`,
    `Tamaño: ${cliente?.tamano ?? 'N/A'}`,
    `Objetivos: ${(cliente?.objetivos_estrategicos ?? 'N/A').slice(0, 300)}`,
    `Proyecto: ${proyecto?.nombre ?? 'N/A'}`,
    `Alcance: ${(proyecto?.alcance ?? 'N/A').slice(0, 300)}`,
  ].join('\n')

  const metadataIa = proceso.metadata_ia as { criticidad?: string } | null

  const proceso_contexto = [
    `Proceso: ${proceso.nombre}`,
    `Descripción: ${proceso.descripcion ?? 'Sin descripción'}`,
    `Roles: ${proceso.roles_involucrados?.join(', ') ?? 'N/A'}`,
    `Riesgos: ${proceso.riesgos_detectados?.join(', ') ?? 'N/A'}`,
    `Criticidad: ${metadataIa?.criticidad ?? 'N/A'}`,
    insightsDeAnalisis ? `\nInteligencia del documento origen:\n${insightsDeAnalisis}` : '',
  ].filter(Boolean).join('\n')

  return { proceso: ctx, documentos, analisis_ia, proyecto_contexto, proceso_contexto }
}

/**
 * Extrae los insights más valiosos del analisis_ia JSONB
 * para incluirlos en el contexto sin re-enviar texto crudo.
 * Resultado: ~800-1200 tokens en vez de 10.000 tokens de texto del doc.
 */
function buildInsightsFromAnalisis(analisis: { clasificacion?: unknown; analisis?: ResumenDoc }): string {
  const a = analisis?.analisis ?? (analisis as unknown as ResumenDoc)
  const parts: string[] = []

  if (a?.resumen_ejecutivo) parts.push(`Diagnóstico: ${a.resumen_ejecutivo}`)
  if (a?.diagnostico_operacional) parts.push(`Estado operacional: ${a.diagnostico_operacional}`)
  if (a?.hallazgos_criticos?.length) {
    parts.push(`Hallazgos críticos:\n${a.hallazgos_criticos.map((h) => `• ${h}`).join('\n')}`)
  }
  if (a?.riesgos_criticos?.length) {
    const riesgos = a.riesgos_criticos
      .map((r) => `• [${r.impacto?.toUpperCase()}] ${r.riesgo}`)
      .join('\n')
    parts.push(`Riesgos:\n${riesgos}`)
  }
  if (a?.oportunidades_valor?.length) {
    const ops = a.oportunidades_valor
      .map((o) => `• ${o.oportunidad} (${o.complejidad_implementacion})`)
      .join('\n')
    parts.push(`Oportunidades:\n${ops}`)
  }
  if (a?.quick_wins?.length) {
    parts.push(`Quick wins:\n${a.quick_wins.map((q) => `• ${q}`).join('\n')}`)
  }
  if (a?.nivel_madurez_nombre) {
    parts.push(`Madurez organizacional: Nivel ${a.nivel_madurez_amo} — ${a.nivel_madurez_nombre}`)
  }
  if (a?.recomendacion_ejecutiva) {
    parts.push(`Recomendación ejecutiva: ${a.recomendacion_ejecutiva}`)
  }

  return parts.join('\n\n').slice(0, 3000) // máx ~750 tokens
}

/**
 * Construye contexto de proyecto para Discovery.
 * Usa resúmenes almacenados — no re-procesa archivos.
 */
// Límite de documentos por llamada de discovery para garantizar respuesta completa.
// El backend trunca adicionalmente en claude.ts si los resúmenes son muy largos.
const MAX_DOCS_DISCOVERY = 10

export async function buildProyectoContext(
  proyectoId: string,
  documentoIds?: string[],
): Promise<{
  empresa: string
  documentos_resumenes: string[]
  // Macroproceso declarado en la carátula de cada documento (extraído por
  // regex al procesar el documento, no por IA) — la fuente de verdad para
  // agrupar procesos en Discovery, indexado por nombre_archivo.
  macroprocesos_por_documento: Record<string, string | null>
}> {
  const admin = createAdminClient()

  let docsQuery = admin.from('documento')
    .select('nombre_archivo, resumen_ejecutivo, analisis_ia, clasificacion, macroproceso')
    .eq('proyecto_id', proyectoId)
    .eq('estado_procesamiento', 'listo')
    .limit(MAX_DOCS_DISCOVERY)

  if (Array.isArray(documentoIds) && documentoIds.length > 0) {
    docsQuery = docsQuery.in('id', documentoIds)
  }

  const [{ data: proyecto }, { data: docs }] = await Promise.all([
    admin.from('proyecto')
      .select('nombre, alcance, cliente:cliente_id(razon_social, industria, tamano, objetivos_estrategicos)')
      .eq('id', proyectoId)
      .single(),
    docsQuery,
  ])

  const cliente = (proyecto as unknown as ProyectoResumen | null)?.cliente ?? null

  const empresa = [
    `Empresa: ${cliente?.razon_social ?? 'N/A'}`,
    `Industria: ${cliente?.industria ?? 'N/A'}`,
    `Tamaño: ${cliente?.tamano ?? 'N/A'}`,
    `Objetivos: ${(cliente?.objetivos_estrategicos ?? 'N/A').slice(0, 400)}`,
  ].join('\n')

  const documentos_resumenes = (docs ?? []).map(d => {
    const docTyped = d as unknown as DocumentoOrigenResumen
    const analisis = docTyped.analisis_ia?.analisis
    const resumen = analisis?.resumen_ejecutivo ?? docTyped.resumen_ejecutivo ?? 'Sin resumen'
    const tipo = (docTyped.clasificacion as { tipo_documento?: string } | null)?.tipo_documento ?? ''
    const macroLinea = docTyped.macroproceso ? `\n[MACROPROCESO DECLARADO: ${docTyped.macroproceso}]` : ''
    return `[${docTyped.nombre_archivo}${tipo ? ` — ${tipo}` : ''}]${macroLinea}\n${resumen.slice(0, 800)}`
  })

  const macroprocesos_por_documento: Record<string, string | null> = {}
  for (const d of docs ?? []) {
    const docTyped = d as unknown as DocumentoOrigenResumen
    macroprocesos_por_documento[docTyped.nombre_archivo] = docTyped.macroproceso ?? null
  }

  return { empresa, documentos_resumenes, macroprocesos_por_documento }
}

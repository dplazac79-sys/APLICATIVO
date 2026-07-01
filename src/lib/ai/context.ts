/**
 * Context Manager — construye el contexto óptimo para cada operación de IA
 * Lee desde DB en vez de re-procesar archivos. Nunca re-envía texto crudo.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import type { ContextoProceso, DocumentoResumen } from '@/lib/ai/artefactos'

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

  const proyecto = proceso.proyecto as any
  const cliente = proyecto?.cliente as any
  const docOrigen = proceso.documento_origen as any

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
  const analisis_ia = docOrigen?.analisis_ia ?? null
  const insightsDeAnalisis = analisis_ia
    ? buildInsightsFromAnalisis(analisis_ia as Record<string, unknown>)
    : docOrigen?.resumen_ejecutivo ?? ''

  const proyecto_contexto = [
    `Empresa: ${cliente?.razon_social ?? 'N/A'}`,
    `Industria: ${cliente?.industria ?? 'N/A'}`,
    `Tamaño: ${cliente?.tamano ?? 'N/A'}`,
    `Objetivos: ${(cliente?.objetivos_estrategicos ?? 'N/A').slice(0, 300)}`,
    `Proyecto: ${proyecto?.nombre ?? 'N/A'}`,
    `Alcance: ${(proyecto?.alcance ?? 'N/A').slice(0, 300)}`,
  ].join('\n')

  const proceso_contexto = [
    `Proceso: ${proceso.nombre}`,
    `Descripción: ${proceso.descripcion ?? 'Sin descripción'}`,
    `Roles: ${proceso.roles_involucrados?.join(', ') ?? 'N/A'}`,
    `Riesgos: ${proceso.riesgos_detectados?.join(', ') ?? 'N/A'}`,
    `Criticidad: ${(proceso.metadata_ia as any)?.criticidad ?? 'N/A'}`,
    insightsDeAnalisis ? `\nInteligencia del documento origen:\n${insightsDeAnalisis}` : '',
  ].filter(Boolean).join('\n')

  return { proceso: ctx, documentos, analisis_ia, proyecto_contexto, proceso_contexto }
}

/**
 * Extrae los insights más valiosos del analisis_ia JSONB
 * para incluirlos en el contexto sin re-enviar texto crudo.
 * Resultado: ~800-1200 tokens en vez de 10.000 tokens de texto del doc.
 */
function buildInsightsFromAnalisis(analisis: Record<string, unknown>): string {
  const a = (analisis as any)?.analisis ?? analisis
  const parts: string[] = []

  if (a?.resumen_ejecutivo) parts.push(`Diagnóstico: ${a.resumen_ejecutivo}`)
  if (a?.diagnostico_operacional) parts.push(`Estado operacional: ${a.diagnostico_operacional}`)
  if (a?.hallazgos_criticos?.length) {
    parts.push(`Hallazgos críticos:\n${(a.hallazgos_criticos as string[]).map((h: string) => `• ${h}`).join('\n')}`)
  }
  if (a?.riesgos_criticos?.length) {
    const riesgos = (a.riesgos_criticos as any[])
      .map((r: any) => `• [${r.impacto?.toUpperCase()}] ${r.riesgo}`)
      .join('\n')
    parts.push(`Riesgos:\n${riesgos}`)
  }
  if (a?.oportunidades_valor?.length) {
    const ops = (a.oportunidades_valor as any[])
      .map((o: any) => `• ${o.oportunidad} (${o.complejidad_implementacion})`)
      .join('\n')
    parts.push(`Oportunidades:\n${ops}`)
  }
  if (a?.quick_wins?.length) {
    parts.push(`Quick wins:\n${(a.quick_wins as string[]).map((q: string) => `• ${q}`).join('\n')}`)
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
export async function buildProyectoContext(proyectoId: string): Promise<{
  empresa: string
  documentos_resumenes: string[]
}> {
  const admin = createAdminClient()

  const [{ data: proyecto }, { data: docs }] = await Promise.all([
    admin.from('proyecto')
      .select('nombre, alcance, cliente:cliente_id(razon_social, industria, tamano, objetivos_estrategicos)')
      .eq('id', proyectoId)
      .single(),
    admin.from('documento')
      .select('nombre_archivo, resumen_ejecutivo, analisis_ia, clasificacion')
      .eq('proyecto_id', proyectoId)
      .eq('estado_procesamiento', 'listo'),
  ])

  const cliente = (proyecto as any)?.cliente as any

  const empresa = [
    `Empresa: ${cliente?.razon_social ?? 'N/A'}`,
    `Industria: ${cliente?.industria ?? 'N/A'}`,
    `Tamaño: ${cliente?.tamano ?? 'N/A'}`,
    `Objetivos: ${(cliente?.objetivos_estrategicos ?? 'N/A').slice(0, 400)}`,
  ].join('\n')

  const documentos_resumenes = (docs ?? []).map(d => {
    const analisis = (d.analisis_ia as any)?.analisis
    const resumen = analisis?.resumen_ejecutivo ?? d.resumen_ejecutivo ?? 'Sin resumen'
    const tipo = (d.clasificacion as any)?.tipo_documento ?? ''
    return `[${d.nombre_archivo}${tipo ? ` — ${tipo}` : ''}]\n${resumen.slice(0, 800)}`
  })

  return { empresa, documentos_resumenes }
}

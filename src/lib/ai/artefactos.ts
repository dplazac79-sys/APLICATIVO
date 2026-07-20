import fs from 'fs'
import path from 'path'
import { chatCompletion, MODELOS } from '@/lib/ai/client'
import type { TipoArtefacto } from '@/types/database'
import { calcularNivelRiesgo, type Probabilidad, type Impacto } from '@/lib/riesgos'
// Re-exportar desde fuente única para evitar duplicación (M2)
export { ORDEN_GENERACION, LABEL_ARTEFACTO } from '@/lib/artefactos-meta'

const promptCache = new Map<string, string>()

function leerPrompt(tipo: TipoArtefacto): string {
  if (promptCache.has(tipo)) return promptCache.get(tipo)!
  const basePaths = [
    path.join(process.cwd(), 'src/lib/prompts/artefactos'),
    path.join(process.cwd(), '.next/server/src/lib/prompts/artefactos'),
    path.join(__dirname, '../prompts/artefactos'),
    path.join(__dirname, '../../lib/prompts/artefactos'),
  ]
  for (const base of basePaths) {
    const archivo = path.join(base, `${tipo}.md`)
    try {
      const content = fs.readFileSync(archivo, 'utf-8')
      promptCache.set(tipo, content)
      return content
    } catch {
      // intentar siguiente ruta
    }
  }
  throw new Error(`Prompt de artefacto "${tipo}" no encontrado`)
}

export interface ContextoProceso {
  nombre: string
  descripcion: string | null
  nivel: number
  origen: string
  roles_involucrados: string[] | null
  riesgos_detectados: string[] | null
  metadata_ia: Record<string, unknown> | null
  proyecto_nombre: string
  cliente_razon_social: string
  cliente_industria: string | null
}

export interface DocumentoResumen {
  nombre_archivo: string
  resumen_ejecutivo: string | null
  clasificacion: Record<string, unknown> | null
}

interface ArtefactosExistentes {
  sipoc?: Record<string, unknown>
  as_is?: Record<string, unknown>
  bpmn?: Record<string, unknown>
  raci?: Record<string, unknown>
  riesgo_control?: Record<string, unknown>
  diagnostico?: Record<string, unknown>
  to_be?: Record<string, unknown>
  dashboard_brechas?: Record<string, unknown>
}

function construirContextoProceso(ctx: ContextoProceso): string {
  return `
Empresa: ${ctx.cliente_razon_social}
Industria: ${ctx.cliente_industria ?? 'N/A'}
Proyecto: ${ctx.proyecto_nombre}
Proceso: ${ctx.nombre} (Nivel ${ctx.nivel})
Descripción: ${ctx.descripcion ?? 'Sin descripción'}
Origen: ${ctx.origen}
Roles involucrados: ${ctx.roles_involucrados?.join(', ') ?? 'N/A'}
Riesgos detectados: ${ctx.riesgos_detectados?.join(', ') ?? 'N/A'}
`.trim()
}

function construirResumenDocumentos(docs: DocumentoResumen[]): string {
  if (!docs.length) return 'ADVERTENCIA: Sin documentos de origen disponibles. Todo lo que generes debe marcarse como [ESPECULATIVO] ya que no hay base documental.'
  return docs.map(d =>
    `### ${d.nombre_archivo}\n${d.resumen_ejecutivo ?? 'Sin resumen.'}`
  ).join('\n\n').slice(0, 3000)
}

async function generarConIA(
  systemPrompt: string,
  userPrompt: string
): Promise<Record<string, unknown>> {
  const modelos = [MODELOS.potente, MODELOS.rapido]
  let lastError = ''

  for (const modelo of modelos) {
    try {
      const completion = await chatCompletion({
        model: modelo,
        max_tokens: 4000,
        temperature: 0.1,
        messages: [
          { role: 'system', content: systemPrompt + '\n\nResponde ÚNICAMENTE con JSON válido, sin texto antes ni después.' },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      })
      const text = completion.choices[0]?.message?.content ?? ''
      if (!text) { lastError = `${modelo}: respuesta vacía`; continue }
      const parsed = JSON.parse(text)
      return (parsed.resultado ?? parsed) as Record<string, unknown>
    } catch (err) {
      lastError = `${modelo}: ${err instanceof Error ? err.message.slice(0, 100) : String(err)}`
      continue
    }
  }
  throw new Error(`Error generando artefacto IA: ${lastError}`)
}

export async function generarArtefacto(
  tipo: TipoArtefacto,
  proceso: ContextoProceso,
  documentos: DocumentoResumen[],
  existentes: ArtefactosExistentes = {}
): Promise<Record<string, unknown>> {
  const plantilla = leerPrompt(tipo)
  const ctxStr = construirContextoProceso(proceso)
  const docsStr = construirResumenDocumentos(documentos)

  // System prompt = plantilla del tipo (estable entre calls del mismo tipo)
  // User prompt = contexto específico del proceso (varía por call)
  const anclaDocumental = documentos.length > 0
    ? '## ⚠️ INSTRUCCIÓN DE ANCLAJE\nTodo el contenido generado DEBE derivarse de la Inteligencia Documental adjunta. Si debes inferir algo no explícito en el documento, prefijar con "[INFERIDO]". No inventes cifras en $ sin respaldo documental.'
    : '## ⚠️ SIN DOCUMENTOS\nNo hay documentos de origen. Marca TODO el contenido como [ESPECULATIVO] y advierte explícitamente que requiere validación documental.'
  let userPrompt = [
    '## Contexto del proceso\n' + ctxStr,
    '## Inteligencia documental\n' + docsStr,
    anclaDocumental,
  ].join('\n\n')

  // Contexto cruzado — antes sipoc/bpmn/raci/riesgo_control/kpi_sla se
  // generaban cada uno aislado del resto, sin ninguna reconciliación de
  // nombres de roles/actores entre artefactos del mismo proceso (ej. BPMN
  // podía nombrar un actor distinto al que usa RACI para el mismo rol).
  // Se pasa el contenido ya generado que sea relevante para mantener
  // consistencia de nomenclatura — hallazgo de auditoría de correctitud de
  // negocio/IA. NOTA_CONSISTENCIA se repite en cada bloque para que el
  // modelo sepa que debe REUTILIZAR los nombres, no solo "considerarlos".
  const NOTA_CONSISTENCIA = 'Reutiliza los mismos nombres de actores/roles que aparecen en el contexto de abajo — no los renombres ni uses una variante distinta para la misma persona/rol.'
  if (tipo === 'bpmn') {
    userPrompt += '\n\n## SIPOC ya generado\n' + JSON.stringify(existentes.sipoc ?? {}, null, 2)
    if (existentes.as_is) userPrompt += '\n\n## AS-IS ya generado\n' + JSON.stringify(existentes.as_is, null, 2)
    userPrompt += '\n\n' + NOTA_CONSISTENCIA
  }
  if (tipo === 'raci') {
    if (existentes.as_is) userPrompt += '\n\n## AS-IS ya generado\n' + JSON.stringify(existentes.as_is, null, 2)
    if (existentes.bpmn) userPrompt += '\n\n## BPMN ya generado (actores/lanes)\n' + JSON.stringify(existentes.bpmn, null, 2)
    userPrompt += '\n\n' + NOTA_CONSISTENCIA
  }
  if (tipo === 'riesgo_control') {
    if (existentes.as_is) userPrompt += '\n\n## AS-IS ya generado\n' + JSON.stringify(existentes.as_is, null, 2)
    if (existentes.raci) userPrompt += '\n\n## RACI ya generado (roles responsables)\n' + JSON.stringify(existentes.raci, null, 2)
    userPrompt += '\n\n' + NOTA_CONSISTENCIA
  }
  if (tipo === 'kpi_sla') {
    if (existentes.as_is) userPrompt += '\n\n## AS-IS ya generado\n' + JSON.stringify(existentes.as_is, null, 2)
    if (existentes.riesgo_control) userPrompt += '\n\n## Riesgos ya identificados\n' + JSON.stringify(existentes.riesgo_control, null, 2)
  }
  if (tipo === 'to_be') {
    userPrompt += '\n\n## AS-IS\n' + JSON.stringify(existentes.as_is ?? {}, null, 2)
    userPrompt += '\n\n## Diagnóstico\n' + JSON.stringify(existentes.diagnostico ?? {}, null, 2)
  }
  if (tipo === 'dashboard_brechas') {
    userPrompt += '\n\n## AS-IS\n' + JSON.stringify(existentes.as_is ?? {}, null, 2)
    userPrompt += '\n\n## TO-BE\n' + JSON.stringify(existentes.to_be ?? {}, null, 2)
  }
  if (tipo === 'cierre_ejecutivo') {
    userPrompt += '\n\n## Diagnóstico\n' + JSON.stringify(existentes.diagnostico ?? {}, null, 2)
    userPrompt += '\n\n## Dashboard brechas\n' + JSON.stringify(existentes.dashboard_brechas ?? {}, null, 2)
  }

  const resultado = await generarConIA(plantilla, userPrompt)

  if (tipo === 'riesgo_control') {
    // El prompt le da al modelo su propia versión simplificada de la regla
    // ("alto: una de las dos dimensiones alta"), que no coincide con
    // calcularNivelRiesgo() — la función canónica que sí se usa cuando un
    // consultor edita un riesgo a mano (src/app/api/riesgos/route.ts). Sin
    // esto, una matriz podía mostrar el mismo par probabilidad/impacto con
    // dos niveles de riesgo distintos según si la fila la generó la IA o la
    // editó un humano. Se recalcula server-side con la regla real en vez de
    // confiar en el criterio del modelo — hallazgo de auditoría de
    // correctitud de negocio/IA.
    recalcularNivelesDeRiesgo(resultado)
  }

  return resultado
}

function recalcularNivelesDeRiesgo(resultado: Record<string, unknown>): void {
  const riesgos = resultado.riesgos
  if (!Array.isArray(riesgos)) return
  for (const r of riesgos) {
    if (!r || typeof r !== 'object') continue
    const item = r as Record<string, unknown>
    const probabilidad = item.probabilidad as Probabilidad
    const impacto = item.impacto as Impacto
    if (
      ['alta', 'media', 'baja'].includes(probabilidad) &&
      ['alto', 'medio', 'bajo'].includes(impacto)
    ) {
      item.nivel_riesgo = calcularNivelRiesgo(probabilidad, impacto)
    }
  }
}

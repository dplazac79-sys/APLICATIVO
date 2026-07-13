import fs from 'fs'
import path from 'path'
import { chatCompletion, MODELOS } from '@/lib/ai/client'
import type { TipoArtefacto } from '@/types/database'
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
  as_is?: Record<string, unknown>
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

  return generarConIA(plantilla, userPrompt)
}

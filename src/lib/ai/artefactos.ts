import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import type { TipoArtefacto } from '@/types/database'
import { extractJson } from '@/lib/ai/claude'
// Re-exportar desde fuente única para evitar duplicación (M2)
export { ORDEN_GENERACION, LABEL_ARTEFACTO } from '@/lib/artefactos-meta'

const client = new Anthropic()

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
  if (!docs.length) return 'Sin documentos de origen disponibles.'
  return docs.map(d =>
    `### ${d.nombre_archivo}\n${d.resumen_ejecutivo ?? 'Sin resumen.'}`
  ).join('\n\n').slice(0, 3000)
}

/**
 * Llama a Claude usando tool_use para JSON estructurado garantizado.
 * - Prompt caching en system prompt (mismo para todos los artefactos del mismo tipo)
 * - tool_use en vez de extractJson: no puede fallar el parsing
 */
async function llamarClaudeConCache(
  systemPrompt: string,
  userPrompt: string
): Promise<Record<string, unknown>> {
  const msg = await (client as any).beta.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    betas: ['prompt-caching-2024-07-31'],
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' }, // cacheado entre artefactos del mismo tipo
      },
    ],
    tools: [
      {
        name: 'generar_artefacto',
        description: 'Genera el artefacto solicitado en formato JSON estructurado',
        input_schema: {
          type: 'object',
          properties: { resultado: { type: 'object', description: 'El artefacto completo' } },
          required: ['resultado'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'generar_artefacto' },
    messages: [{ role: 'user', content: userPrompt }],
  })

  const toolBlock = msg.content.find((b: any) => b.type === 'tool_use')
  if (!toolBlock) throw new Error('Claude no retornó herramienta — respuesta inesperada')
  return (toolBlock as any).input.resultado as Record<string, unknown>
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

  // System prompt = plantilla del tipo (cacheado por Anthropic entre calls del mismo tipo)
  // User prompt = contexto específico del proceso (varía por call)
  let userPrompt = [
    '## Contexto del proceso\n' + ctxStr,
    '## Inteligencia documental\n' + docsStr,
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

  return llamarClaudeConCache(plantilla, userPrompt)
}

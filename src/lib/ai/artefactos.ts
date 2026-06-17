import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import type { TipoArtefacto } from '@/types/database'
// Re-exportar desde fuente única para evitar duplicación (M2)
export { ORDEN_GENERACION, LABEL_ARTEFACTO } from '@/lib/artefactos-meta'

const client = new Anthropic()

function leerPrompt(tipo: TipoArtefacto): string {
  const archivo = path.join(process.cwd(), 'src/lib/prompts/artefactos', `${tipo}.md`)
  return fs.readFileSync(archivo, 'utf-8')
}

// Fuente única de extractJson — evita duplicación con claude.ts (M3)
function extractJson(text: string): Record<string, unknown> {
  const match = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/)
  const raw = match ? match[1] ?? match[0] : text
  return JSON.parse(raw.trim())
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
  if (!docs.length) return 'Sin documentos de origen disponibles. Basar el análisis en el contexto del proceso provisto.'
  return docs.map(d =>
    `### ${d.nombre_archivo}\n${d.resumen_ejecutivo ?? 'Sin resumen disponible.'}`
  ).join('\n\n')
}

async function llamarClaude(promptFinal: string): Promise<Record<string, unknown>> {
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: promptFinal }],
  })
  const texto = msg.content[0].type === 'text' ? msg.content[0].text : ''
  return extractJson(texto)
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

  let prompt = plantilla
    .replace('{{CONTEXTO_PROCESO}}', ctxStr)
    .replace('{{DOCUMENTOS}}', docsStr)

  if (tipo === 'to_be') {
    prompt = prompt
      .replace('{{ASIS}}', JSON.stringify(existentes.as_is ?? {}, null, 2))
      .replace('{{DIAGNOSTICO}}', JSON.stringify(existentes.diagnostico ?? {}, null, 2))
  }
  if (tipo === 'dashboard_brechas') {
    prompt = prompt
      .replace('{{ASIS}}', JSON.stringify(existentes.as_is ?? {}, null, 2))
      .replace('{{TOBE}}', JSON.stringify(existentes.to_be ?? {}, null, 2))
  }
  if (tipo === 'cierre_ejecutivo') {
    prompt = prompt
      .replace('{{DIAGNOSTICO}}', JSON.stringify(existentes.diagnostico ?? {}, null, 2))
      .replace('{{DASHBOARD_BRECHAS}}', JSON.stringify(existentes.dashboard_brechas ?? {}, null, 2))
  }

  return llamarClaude(prompt)
}

import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { extractJson } from '@/lib/ai/claude'
import type { RecomendacionIA, KgIndustriaSnapshot } from './tipos'

const client = new Anthropic()
const promptCache = new Map<string, string>()

function loadPrompt(name: string): string {
  if (promptCache.has(name)) return promptCache.get(name)!
  const filePath = path.join(process.cwd(), 'src/lib/prompts', `${name}.md`)
  const content = fs.readFileSync(filePath, 'utf-8')
  promptCache.set(name, content)
  return content
}

export interface ContextoRecomendacion {
  proceso_nombre: string
  artefacto_tobe_resumen: string
  brechas_resumen: string
  simulacion_tipo: string
  mejora_tiempo_pct: number
  ftes_liberados: number
  roi_pct: number
  payback_meses: number
  industria: string
  kg_snapshot?: KgIndustriaSnapshot | null
}

export async function generarRecomendaciones(
  ctx: ContextoRecomendacion
): Promise<RecomendacionIA[]> {
  const template = loadPrompt('automation-recommendation')

  const kgPatrones = ctx.kg_snapshot
    ? JSON.stringify({
        procesos_frecuentes: ctx.kg_snapshot.procesos_frecuentes.slice(0, 5),
        automatizaciones: ctx.kg_snapshot.automatizaciones.slice(0, 5),
      }, null, 2)
    : 'No hay datos previos para esta industria.'

  const prompt = template
    .replace('{{proceso_nombre}}', ctx.proceso_nombre)
    .replace('{{artefacto_tobe_resumen}}', ctx.artefacto_tobe_resumen || 'No disponible')
    .replace('{{brechas_resumen}}', ctx.brechas_resumen || 'No disponible')
    .replace('{{simulacion_tipo}}', ctx.simulacion_tipo)
    .replace('{{mejora_tiempo_pct}}', String(ctx.mejora_tiempo_pct))
    .replace('{{ftes_liberados}}', String(ctx.ftes_liberados))
    .replace('{{roi_pct}}', String(ctx.roi_pct))
    .replace('{{payback_meses}}', String(ctx.payback_meses))
    .replace('{{industria}}', ctx.industria)
    .replace('{{kg_patrones_industria}}', kgPatrones)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const parsed = extractJson(text) as { recomendaciones: RecomendacionIA[] }
  return parsed?.recomendaciones ?? []
}

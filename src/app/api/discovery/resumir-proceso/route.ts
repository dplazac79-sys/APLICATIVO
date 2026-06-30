import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { proceso_id } = await req.json()
  if (!proceso_id) return NextResponse.json({ error: 'Falta proceso_id' }, { status: 400 })

  const admin = createAdminClient()
  const { data: proceso } = await admin
    .from('proceso')
    .select('*, proyecto:proyecto_id(nombre, contexto, objetivos)')
    .eq('id', proceso_id)
    .single()

  if (!proceso) return NextResponse.json({ error: 'Proceso no encontrado' }, { status: 404 })

  const meta = proceso.metadata_ia as Record<string, unknown> | null

  const prompt = `Eres un consultor experto en procesos organizacionales.
Analiza este proceso empresarial y entrega un diagnóstico ejecutivo conciso pero poderoso.

PROCESO: ${proceso.nombre}
DESCRIPCIÓN: ${proceso.descripcion ?? 'No disponible'}
PROYECTO: ${(proceso.proyecto as any)?.nombre ?? ''}
CONTEXTO: ${(proceso.proyecto as any)?.contexto ?? ''}
CRITICIDAD: ${meta?.criticidad ?? 'No evaluada'}
ESTADO ACTUAL: ${meta?.estado_actual ?? 'No disponible'}
ROLES INVOLUCRADOS: ${(proceso.roles_involucrados ?? []).join(', ') || 'No identificados'}
RIESGOS DETECTADOS: ${(proceso.riesgos_detectados ?? []).join(' | ') || 'Ninguno identificado'}
OPORTUNIDADES DE MEJORA: ${(Array.isArray(meta?.oportunidades_mejora) ? (meta.oportunidades_mejora as string[]).join(' | ') : '') || 'No evaluadas'}
OPORTUNIDADES DE AUTOMATIZACIÓN: ${(Array.isArray(meta?.oportunidades_automatizacion) ? (meta.oportunidades_automatizacion as string[]).join(', ') : '') || 'No identificadas'}

Responde en JSON con este formato exacto:
{
  "diagnostico": "2-3 frases que explican qué hace este proceso y por qué importa al negocio",
  "estado_salud": "critico|en_riesgo|estable|optimizado",
  "impacto_negocio": "1 frase del impacto si este proceso falla o se optimiza",
  "quick_win": "La acción más concreta y rápida que se puede implementar en menos de 30 días",
  "potencial_automatizacion": "alto|medio|bajo",
  "siguiente_paso": "Qué debería hacer el equipo consultor con este proceso ahora mismo"
}`

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (response.content[0] as { type: string; text: string }).text
  let resultado: Record<string, unknown>
  try {
    const match = text.match(/\{[\s\S]*\}/)
    resultado = JSON.parse(match ? match[0] : text)
  } catch {
    resultado = { diagnostico: text, estado_salud: 'estable', impacto_negocio: '', quick_win: '', potencial_automatizacion: 'medio', siguiente_paso: '' }
  }

  return NextResponse.json({ ok: true, resumen: resultado })
}

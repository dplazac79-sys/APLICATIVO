import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
const MAX_CHARS = 1200

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = createAdminClient()

  const { data: proceso } = await admin
    .from('proceso')
    .select('nombre, descripcion, roles_involucrados, metadata_ia, documento_origen_id')
    .eq('id', params.id)
    .single()
  if (!proceso) return NextResponse.json({ error: 'no_encontrado' }, { status: 404 })

  let analisisCtx = ''
  if (proceso.documento_origen_id) {
    const { data: doc } = await admin
      .from('documento')
      .select('analisis_ia')
      .eq('id', proceso.documento_origen_id)
      .single()
    if (doc?.analisis_ia) {
      const ia = doc.analisis_ia as Record<string, unknown>
      const partes = [
        ia.resumen_ejecutivo,
        ia.diagnostico_operacional,
        ia.recomendacion_ejecutiva,
        Array.isArray(ia.quick_wins) ? (ia.quick_wins as string[]).join('. ') : '',
        Array.isArray(ia.proximos_pasos_sugeridos) ? (ia.proximos_pasos_sugeridos as string[]).join('. ') : '',
        Array.isArray(ia.oportunidades_valor)
          ? (ia.oportunidades_valor as Array<{ oportunidad: string }>).map(o => o.oportunidad).join('. ')
          : '',
      ].filter(Boolean).join('\n')
      analisisCtx = partes.slice(0, MAX_CHARS)
    }
  }

  const prompt = `Eres un consultor senior de procesos, transformación digital e innovación. Analiza el siguiente contexto del proceso "${proceso.nombre}" y genera un plan de implementación estructurado, ambicioso y accionable.

CONTEXTO DEL PROCESO:
${analisisCtx || proceso.descripcion || 'Sin contexto adicional.'}

ROLES INVOLUCRADOS: ${(proceso.roles_involucrados ?? []).join(', ')}

Genera un plan de implementación en JSON con esta estructura exacta:
{
  "contexto_estrategico": "2-3 oraciones que expliquen por qué este proceso es CRÍTICO para la organización ahora, qué problema de negocio resuelve y qué pasa si no se implementa",
  "situacion_actual": "1-2 oraciones precisas describiendo el estado operacional HOY — sin suavizar",
  "antes": [
    { "categoria": "Estructura", "accion": "...", "responsable": "...", "urgencia": "critica|alta|media" },
    { "categoria": "Datos", "accion": "...", "responsable": "...", "urgencia": "critica|alta|media" },
    { "categoria": "Capacidades", "accion": "...", "responsable": "...", "urgencia": "critica|alta|media" },
    { "categoria": "Tecnología", "accion": "...", "responsable": "...", "urgencia": "critica|alta|media" }
  ],
  "durante": [
    { "categoria": "Gobierno", "accion": "...", "responsable": "...", "urgencia": "alta|media" },
    { "categoria": "Roles", "accion": "...", "responsable": "...", "urgencia": "alta|media" },
    { "categoria": "Herramientas", "accion": "...", "responsable": "...", "urgencia": "alta|media" },
    { "categoria": "Gestión del Cambio", "accion": "...", "responsable": "...", "urgencia": "alta|media" }
  ],
  "despues": [
    { "categoria": "Medición", "accion": "...", "responsable": "...", "urgencia": "media" },
    { "categoria": "Mejora Continua", "accion": "...", "responsable": "...", "urgencia": "media" },
    { "categoria": "Escalabilidad", "accion": "...", "responsable": "...", "urgencia": "media" }
  ],
  "factores_criticos_exito": ["...", "...", "..."],
  "riesgos_implementacion": ["...", "...", "..."]
}

Responde SOLO con el JSON, sin texto adicional. Sé específico, directo y orientado a resultados medibles.`

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.3,
    })

    const raw = completion.choices[0]?.message?.content ?? ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'parse_error' }, { status: 500 })

    const plan = JSON.parse(jsonMatch[0])

    // Guardar en metadata_ia para no recalcular
    const { data: proc2 } = await admin.from('proceso').select('metadata_ia').eq('id', params.id).single()
    const meta = (proc2?.metadata_ia ?? {}) as Record<string, unknown>
    await admin.from('proceso').update({ metadata_ia: { ...meta, plan_implementacion: plan } }).eq('id', params.id)

    return NextResponse.json({ plan })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Groq from 'groq-sdk'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = createAdminClient()
  const { data: proceso } = await admin.from('proceso').select('metadata_ia').eq('id', params.id).single()
  if (!proceso) return NextResponse.json({ plan: null })
  const plan = (proceso.metadata_ia as any)?.plan_implementacion ?? null
  return NextResponse.json({ plan })
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
  const admin = createAdminClient()

  const { data: proceso } = await admin
    .from('proceso')
    .select('nombre, descripcion, roles_involucrados, metadata_ia, documento_origen_id')
    .eq('id', params.id)
    .single()
  if (!proceso) return NextResponse.json({ error: 'no_encontrado' }, { status: 404 })

  // Cargar analisis_ia completo del documento origen
  let ia: Record<string, unknown> = {}
  if (proceso.documento_origen_id) {
    const { data: doc } = await admin
      .from('documento')
      .select('analisis_ia')
      .eq('id', proceso.documento_origen_id)
      .single()
    if (doc?.analisis_ia) ia = doc.analisis_ia as Record<string, unknown>
  }

  // analisis_ia tiene estructura { clasificacion: {...}, analisis: { resumen_ejecutivo, ... } }
  const analisis = ((ia.analisis ?? ia) as Record<string, unknown>)

  const resumenDoc       = (analisis.resumen_ejecutivo as string)         ?? proceso.descripcion ?? ''
  const diagnosticoDoc   = (analisis.diagnostico_operacional as string)   ?? ''
  const recomendacionDoc = (analisis.recomendacion_ejecutiva as string)   ?? ''
  const hallazgos        = (analisis.hallazgos_criticos as string[])      ?? []
  const riesgosDoc       = (analisis.riesgos_criticos as Array<{ riesgo: string; impacto: string }>) ?? []
  const oportunidades    = (analisis.oportunidades_valor as Array<{ oportunidad: string; complejidad_implementacion: string }>) ?? []
  const quickWins        = (analisis.quick_wins as string[])              ?? []
  const brechas          = (analisis.brechas_documentacion as string[])   ?? []
  const madurezN         = (analisis.nivel_madurez_amo as number)         ?? null
  const madurezNombre    = (analisis.nivel_madurez_nombre as string)      ?? ''
  const madurezEvidencia = (analisis.nivel_madurez_evidencia as string)   ?? ''
  const roles            = (proceso.roles_involucrados ?? []) as string[]

  // Todo lo que el AI recibe viene textualmente del documento procesado por Claude
  const prompt = `Eres un consultor senior de AICOUNTS Consultores especializado en transformación de procesos. Tu tarea es generar un plan de implementación para el proceso "${proceso.nombre}" BASÁNDOTE ESTRICTAMENTE en el análisis documental que se adjunta. No debes inventar ni suponer — todo lo que redactes debe poder rastrearse a los datos del documento.

═══ ANÁLISIS DOCUMENTAL (extraído directamente del documento formal) ═══

RESUMEN EJECUTIVO DEL DOCUMENTO:
"${resumenDoc.slice(0, 800)}"

DIAGNÓSTICO OPERACIONAL ACTUAL:
"${diagnosticoDoc.slice(0, 500)}"

HALLAZGOS CRÍTICOS DEL DOCUMENTO (${hallazgos.length}):
${hallazgos.map((h, i) => `${i + 1}. ${h}`).join('\n')}

RIESGOS IDENTIFICADOS EN EL DOCUMENTO:
${riesgosDoc.map(r => `- [${r.impacto?.toUpperCase()}] ${r.riesgo}`).join('\n')}

OPORTUNIDADES DE VALOR DETECTADAS:
${oportunidades.map(o => `- [${o.complejidad_implementacion}] ${o.oportunidad}`).join('\n')}

BRECHAS DE FORMALIZACIÓN:
${brechas.map(b => `- ${b}`).join('\n')}

NIVEL DE MADUREZ ACTUAL: ${madurezN ?? 'N/D'}/5 — ${madurezNombre}
Evidencia: "${madurezEvidencia.slice(0, 300)}"

QUICK WINS IDENTIFICADOS:
${quickWins.map(q => `- ${q}`).join('\n')}

RECOMENDACIÓN EJECUTIVA DEL ANÁLISIS:
"${recomendacionDoc.slice(0, 400)}"

ROLES INVOLUCRADOS: ${roles.join(', ')}

═══ INSTRUCCIÓN ═══

Usando EXCLUSIVAMENTE los datos anteriores como base, genera el siguiente JSON. Cada campo debe reflejar lo que el documento dice, enriquecido con tu inteligencia de consultor para dar contexto estratégico y accionabilidad. Si un dato no está en el documento, no lo inventes — omítelo o indica que debe relevarse.

{
  "contexto_estrategico": "2-3 oraciones que COMBINEN lo que dice el documento con el impacto estratégico real. Debe citar o parafrasear el diagnóstico del documento para que sea trazable.",
  "situacion_actual": "1-2 oraciones describiendo el estado actual TAL COMO LO REVELA EL DOCUMENTO — sin suavizar ni inventar.",
  "antes": [
    { "categoria": "Estructura", "accion": "acción concreta derivada de las brechas del documento", "responsable": "rol específico del proceso", "urgencia": "critica|alta|media" },
    { "categoria": "Datos", "accion": "...", "responsable": "...", "urgencia": "critica|alta|media" },
    { "categoria": "Capacidades", "accion": "...", "responsable": "...", "urgencia": "critica|alta|media" },
    { "categoria": "Tecnología", "accion": "...", "responsable": "...", "urgencia": "critica|alta|media" }
  ],
  "durante": [
    { "categoria": "Gobierno", "accion": "...", "responsable": "...", "urgencia": "alta|media" },
    { "categoria": "Roles", "accion": "acción derivada de los roles y brechas de rol del documento", "responsable": "...", "urgencia": "alta|media" },
    { "categoria": "Herramientas", "accion": "...", "responsable": "...", "urgencia": "alta|media" },
    { "categoria": "Gestión del Cambio", "accion": "...", "responsable": "...", "urgencia": "alta|media" }
  ],
  "despues": [
    { "categoria": "Medición", "accion": "KPI o métrica que el documento sugiere o que se desprende de los hallazgos", "responsable": "...", "urgencia": "media" },
    { "categoria": "Mejora Continua", "accion": "...", "responsable": "...", "urgencia": "media" },
    { "categoria": "Escalabilidad", "accion": "...", "responsable": "...", "urgencia": "media" }
  ],
  "factores_criticos_exito": ["derivado de quick wins o hallazgos del documento"],
  "riesgos_implementacion": ["riesgo derivado directamente de los riesgos del documento"]
}

Responde SOLO con el JSON. Sé directo, específico y trazable al documento.`

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2500,
      temperature: 0.2,  // más bajo = menos alucinación
    })

    const raw = completion.choices[0]?.message?.content ?? ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'parse_error' }, { status: 500 })

    const plan = JSON.parse(jsonMatch[0])

    // Guardar en metadata_ia para caché
    const { data: proc2 } = await admin.from('proceso').select('metadata_ia').eq('id', params.id).single()
    const meta = (proc2?.metadata_ia ?? {}) as Record<string, unknown>
    await admin.from('proceso').update({
      metadata_ia: { ...meta, plan_implementacion: plan },
    }).eq('id', params.id)

    return NextResponse.json({ plan })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

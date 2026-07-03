import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

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

  // Cargar analisis_ia del documento origen — ancla documental obligatoria
  let ia: Record<string, unknown> = {}
  if (proceso.documento_origen_id) {
    const { data: doc } = await admin
      .from('documento')
      .select('analisis_ia')
      .eq('id', proceso.documento_origen_id)
      .single()
    if (doc?.analisis_ia) ia = doc.analisis_ia as Record<string, unknown>
  }

  const resumenDoc       = (ia.resumen_ejecutivo as string)       ?? ''
  const diagnosticoDoc   = (ia.diagnostico_operacional as string) ?? ''
  const hallazgosDoc     = (ia.hallazgos_criticos as string[])    ?? []
  const riesgosDoc       = (ia.riesgos_criticos as Array<{ riesgo: string; impacto: string }>) ?? []
  const quickWinsDoc     = (ia.quick_wins as string[])            ?? []
  const madurezNombre    = (ia.nivel_madurez_nombre as string)    ?? ''
  const recomendacionDoc = (ia.recomendacion_ejecutiva as string) ?? ''

  const tieneDocumento = resumenDoc.length > 0

  const systemPrompt = `Eres un consultor experto en procesos organizacionales de AICOUNTS Consultores.
${tieneDocumento
  ? 'Basándote ESTRICTAMENTE en el análisis documental adjunto, entrega un diagnóstico ejecutivo del proceso. No inventes ni supones — todo debe rastrearse al documento.'
  : 'El proceso aún no tiene documento analizado. Usa solo los metadatos disponibles y sé explícito en que es un análisis preliminar.'}`

  const userPrompt = `PROCESO: ${proceso.nombre}
PROYECTO: ${(proceso.proyecto as Record<string, unknown>)?.nombre ?? ''}
CRITICIDAD: ${meta?.criticidad ?? 'No evaluada'}
ROLES INVOLUCRADOS: ${(proceso.roles_involucrados ?? []).join(', ') || 'No identificados'}

${tieneDocumento ? `═══ ANÁLISIS DOCUMENTAL (fuente primaria) ═══

RESUMEN EJECUTIVO:
"${resumenDoc.slice(0, 600)}"

DIAGNÓSTICO OPERACIONAL:
"${diagnosticoDoc.slice(0, 400)}"

HALLAZGOS CRÍTICOS (${hallazgosDoc.length}):
${hallazgosDoc.slice(0, 5).map((h, i) => `${i + 1}. ${h}`).join('\n')}

RIESGOS IDENTIFICADOS:
${riesgosDoc.slice(0, 3).map(r => `- [${r.impacto?.toUpperCase()}] ${r.riesgo}`).join('\n')}

QUICK WINS:
${quickWinsDoc.slice(0, 3).map(q => `- ${q}`).join('\n')}

NIVEL DE MADUREZ: ${madurezNombre}
RECOMENDACIÓN EJECUTIVA: "${recomendacionDoc.slice(0, 300)}"` : `DESCRIPCIÓN: ${proceso.descripcion ?? 'No disponible'}
ESTADO ACTUAL: ${meta?.estado_actual ?? 'No disponible'}`}

Responde SOLO en JSON con este formato exacto (sin texto extra):
{
  "diagnostico": "${tieneDocumento ? '2-3 frases que citen o parafraseen el diagnóstico del documento formal' : '2-3 frases basadas solo en metadatos disponibles — indica que es preliminar'}",
  "estado_salud": "critico|en_riesgo|estable|optimizado",
  "impacto_negocio": "1 frase del impacto si este proceso falla o se optimiza",
  "quick_win": "${tieneDocumento ? 'Acción concreta derivada de los quick wins del documento' : 'Acción preliminar — requiere análisis documental para validar'}",
  "potencial_automatizacion": "alto|medio|bajo",
  "siguiente_paso": "Qué debería hacer el equipo consultor con este proceso ahora mismo",
  "ancla_documental": ${tieneDocumento ? 'true' : 'false'}
}`

  let resultado: Record<string, unknown>
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 600,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })
    const text = completion.choices[0]?.message?.content ?? ''
    const match = text.match(/\{[\s\S]*\}/)
    try {
      resultado = JSON.parse(match ? match[0] : text)
    } catch {
      resultado = { diagnostico: text, estado_salud: 'estable', impacto_negocio: '', quick_win: '', potencial_automatizacion: 'medio', siguiente_paso: '', ancla_documental: tieneDocumento }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Error IA: ${msg}` }, { status: 502 })
  }

  return NextResponse.json({ ok: true, resumen: resultado })
}

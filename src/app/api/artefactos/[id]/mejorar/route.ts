import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Groq from 'groq-sdk'
import { LABEL_ARTEFACTO } from '@/lib/artefactos-meta'
import type { TipoArtefacto } from '@/types/database'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: artefacto } = await admin
    .from('artefacto')
    .select('*, proceso:proceso_id(nombre, descripcion, proyecto:proyecto_id(nombre, cliente:cliente_id(razon_social, industria)))')
    .eq('id', params.id)
    .single()

  if (!artefacto) return NextResponse.json({ error: 'Artefacto no encontrado' }, { status: 404 })

  const body = await req.json() as { instruccion?: string; campo?: string }
  const { instruccion, campo } = body

  const proceso = artefacto.proceso as Record<string, unknown>
  const proyecto = proceso?.proyecto as Record<string, unknown>
  const cliente = proyecto?.cliente as Record<string, unknown>
  const tipoLabel = LABEL_ARTEFACTO[artefacto.tipo as TipoArtefacto] ?? artefacto.tipo

  const systemPrompt = `Eres un consultor senior de procesos organizacionales de AICOUNTS Consultores.
Tu rol: mejorar artefactos metodológicos existentes basándote en las mejores prácticas (ISO, APQC, SCOR, Lean, Six Sigma).

REGLAS:
1. Devuelve el artefacto COMPLETO mejorado en el mismo formato JSON
2. Mantén la misma estructura de campos — solo mejora el contenido
3. No elimines campos existentes ni agregues campos nuevos
4. Basa las mejoras en el contexto de la empresa y proceso
5. Responde ÚNICAMENTE con JSON válido`

  const userPrompt = `EMPRESA: ${String(cliente?.razon_social ?? 'N/A')}
INDUSTRIA: ${String(cliente?.industria ?? 'N/A')}
PROCESO: ${String(proceso?.nombre ?? 'N/A')} — ${String(proceso?.descripcion ?? '')}
TIPO DE ARTEFACTO: ${tipoLabel}

ARTEFACTO ACTUAL:
${JSON.stringify(artefacto.contenido, null, 2).slice(0, 4000)}

${instruccion ? `INSTRUCCIÓN DEL CONSULTOR: ${instruccion}` : 'INSTRUCCIÓN: Mejora la calidad, completitud y precisión del artefacto.'}
${campo ? `ENFÓCATE EN: el campo "${campo}"` : ''}

Devuelve el JSON completo del artefacto mejorado, manteniendo exactamente la misma estructura de campos.`

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
  const modelos = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']
  let lastError = ''

  for (const modelo of modelos) {
    try {
      const completion = await groq.chat.completions.create({
        model: modelo,
        max_tokens: 4000,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      })
      const text = completion.choices[0]?.message?.content ?? ''
      if (!text) { lastError = `${modelo}: vacío`; continue }
      const parsed = JSON.parse(text)
      const contenidoMejorado = (parsed.resultado ?? parsed.contenido ?? parsed) as Record<string, unknown>
      return NextResponse.json({ contenido: contenidoMejorado })
    } catch (err) {
      lastError = `${modelo}: ${err instanceof Error ? err.message.slice(0, 80) : String(err)}`
      continue
    }
  }

  return NextResponse.json({ error: `Error IA: ${lastError}` }, { status: 500 })
}

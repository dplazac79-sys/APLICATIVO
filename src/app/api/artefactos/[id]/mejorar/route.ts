import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { chatCompletion, MODELOS } from '@/lib/ai/client'
import { LABEL_ARTEFACTO } from '@/lib/artefactos-meta'
import { extraerTextoPDF, extraerTextoDOCX } from '@/lib/extract-text'
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
  const esDiagrama = artefacto.tipo === 'bpmn' || artefacto.tipo === 'flujograma'

  // Para diagramas: extraer texto del documento para generar nodos reales
  let textoDocumento = ''
  if (esDiagrama) {
    try {
      // Buscar documento origen del proceso
      const { data: procesoData } = await admin
        .from('proceso')
        .select('documento_origen_id, proyecto_id')
        .eq('id', artefacto.proceso_id)
        .single()

      let docId = procesoData?.documento_origen_id as string | null
      if (!docId) {
        const { data: docs } = await admin
          .from('documento')
          .select('id')
          .eq('proyecto_id', procesoData?.proyecto_id)
          .not('analisis_ia', 'is', null)
          .limit(1)
        docId = docs?.[0]?.id ?? null
      }
      if (docId) {
        const { data: doc } = await admin.from('documento').select('*').eq('id', docId).single()
        if (doc) {
          const { data: fileData } = await admin.storage.from('documentos').download(doc.url_storage as string)
          if (fileData) {
            const buffer = Buffer.from(await fileData.arrayBuffer())
            const nombre = (doc.nombre_archivo as string).toLowerCase()
            if (nombre.endsWith('.docx') || nombre.endsWith('.doc')) textoDocumento = await extraerTextoDOCX(buffer)
            else if (nombre.endsWith('.pdf')) textoDocumento = await extraerTextoPDF(buffer)
          }
        }
      }
    } catch (err) {
      console.error('[mejorar] Error cargando documento:', err)
    }
  }

  const systemPrompt = `Eres un consultor senior de procesos organizacionales de AICOUNTS Consultores.
Tu rol: mejorar artefactos metodológicos existentes basándote en las mejores prácticas (ISO, APQC, SCOR, Lean, Six Sigma).

REGLAS:
1. Devuelve el artefacto COMPLETO mejorado en el mismo formato JSON
2. Mantén la misma estructura de campos — solo mejora el contenido
3. No elimines campos existentes ni agregues campos nuevos
4. Basa las mejoras en el contexto de la empresa y proceso
5. Responde ÚNICAMENTE con JSON válido`

  const userPromptDiagrama = `EMPRESA: ${String(cliente?.razon_social ?? 'N/A')}
PROCESO: ${String(proceso?.nombre ?? 'N/A')}

CONTENIDO DEL DOCUMENTO (fuente de verdad):
${textoDocumento.slice(0, 10000)}

Genera un diagrama de flujo COMPLETO y DETALLADO para React Flow en formato JSON.
${instruccion ? `INSTRUCCIÓN ADICIONAL: ${instruccion}` : ''}

Reglas para el diagrama:
- Extrae TODOS los pasos reales del proceso desde el documento
- Tipo "start" para inicio (1 solo, verde), "end" para fin (1 solo, rojo), "task" para tareas (azul), "decision" para gateways (índigo)
- Posiciona verticalmente con 130px de separación entre nodos, x=400 para el flujo principal, x=650 para ramales
- Labels cortos y descriptivos (máx 45 chars)
- Mínimo 6 nodos, máximo 14 nodos
- Conecta todos los nodos con edges lógicos

Devuelve EXACTAMENTE este formato:
{"titulo":"...","nodes":[{"id":"1","type":"start","position":{"x":400,"y":50},"data":{"label":"Inicio"}},...],"edges":[{"id":"e1-2","source":"1","target":"2","animated":true},...]}`

  const userPromptNormal = `EMPRESA: ${String(cliente?.razon_social ?? 'N/A')}
INDUSTRIA: ${String(cliente?.industria ?? 'N/A')}
PROCESO: ${String(proceso?.nombre ?? 'N/A')} — ${String(proceso?.descripcion ?? '')}
TIPO DE ARTEFACTO: ${tipoLabel}

ARTEFACTO ACTUAL:
${JSON.stringify(artefacto.contenido, null, 2).slice(0, 4000)}

${instruccion ? `INSTRUCCIÓN DEL CONSULTOR: ${instruccion}` : 'INSTRUCCIÓN: Mejora la calidad, completitud y precisión del artefacto.'}
${campo ? `ENFÓCATE EN: el campo "${campo}"` : ''}

Devuelve el JSON completo del artefacto mejorado, manteniendo exactamente la misma estructura de campos.`

  const userPrompt = esDiagrama ? userPromptDiagrama : userPromptNormal

  const modelos = [MODELOS.potente, MODELOS.rapido]
  let lastError = ''

  for (const modelo of modelos) {
    try {
      const completion = await chatCompletion({
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

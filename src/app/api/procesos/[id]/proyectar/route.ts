import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Groq from 'groq-sdk'
import { registrarUsoIA } from '@/lib/ai/rate-limit'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
  const admin = createAdminClient()
  const procesoId = params.id

  // 1. Cargar proceso con contexto completo
  const { data: proceso } = await admin
    .from('proceso')
    .select(`
      *,
      proyecto:proyecto_id (
        id, nombre, alcance,
        cliente:cliente_id (razon_social, industria, tamano, objetivos_estrategicos)
      )
    `)
    .eq('id', procesoId)
    .single()

  if (!proceso) return NextResponse.json({ error: 'Proceso no encontrado' }, { status: 404 })

  const proyecto = proceso.proyecto as Record<string, unknown>
  const cliente = proyecto?.cliente as Record<string, unknown> | null
  const proyectoId = proceso.proyecto_id

  // 2. Cargar todos los documentos con análisis IA (mismo patrón que resumir-proceso)
  const { data: documentos } = await admin
    .from('documento')
    .select('id, nombre_archivo, analisis_ia, clasificacion')
    .eq('proyecto_id', proyectoId)
    .not('analisis_ia', 'is', null)
    .order('created_at', { ascending: true })

  const docsConIA = (documentos ?? []).filter(d => d.analisis_ia)

  // 3. Si es macroproceso (nivel=0), cargar también subprocesos con sus resúmenes IA
  const { data: subprocesos } = proceso.nivel === 0
    ? await admin
        .from('proceso')
        .select('nombre, descripcion, roles_involucrados, metadata_ia')
        .eq('padre_id', procesoId)
        .order('orden', { ascending: true })
    : { data: [] }

  // 4. Si es hijo (nivel=1), cargar también su documento origen directo
  let docOrigenInsights = ''
  if (proceso.nivel === 1 && proceso.documento_origen_id) {
    const { data: docOrigen } = await admin
      .from('documento')
      .select('nombre_archivo, analisis_ia')
      .eq('id', proceso.documento_origen_id)
      .single()
    if (docOrigen?.analisis_ia) {
      const ia = ((docOrigen.analisis_ia as any)?.analisis ?? docOrigen.analisis_ia) as Record<string, unknown>
      const parts: string[] = []
      if (ia.resumen_ejecutivo) parts.push(`Diagnóstico del documento: ${(ia.resumen_ejecutivo as string).slice(0, 400)}`)
      if (ia.diagnostico_operacional) parts.push(`Estado operacional: ${(ia.diagnostico_operacional as string).slice(0, 300)}`)
      if ((ia.hallazgos_criticos as string[] | undefined)?.length) {
        parts.push(`Hallazgos críticos:\n${(ia.hallazgos_criticos as string[]).slice(0, 5).map(h => `• ${h}`).join('\n')}`)
      }
      if ((ia.oportunidades_valor as Array<{oportunidad:string}> | undefined)?.length) {
        parts.push(`Oportunidades:\n${(ia.oportunidades_valor as Array<{oportunidad:string}>).slice(0, 4).map(o => `• ${o.oportunidad}`).join('\n')}`)
      }
      if ((ia.quick_wins as string[] | undefined)?.length) {
        parts.push(`Quick wins:\n${(ia.quick_wins as string[]).slice(0, 4).map(q => `• ${q}`).join('\n')}`)
      }
      if (ia.nivel_madurez_nombre) parts.push(`Madurez: Nivel ${ia.nivel_madurez_amo ?? '?'} — ${ia.nivel_madurez_nombre}`)
      docOrigenInsights = parts.join('\n\n')
    }
  }

  // 5. Agregar inteligencia consolidada de todos los documentos
  const resumenes: string[] = []
  const hallazgosGlobal: string[] = []
  const oportunidadesGlobal: string[] = []
  const quickWinsGlobal: string[] = []
  const nivelesMadurez: string[] = []

  for (const doc of docsConIA) {
    const ia = ((doc.analisis_ia as any)?.analisis ?? doc.analisis_ia) as Record<string, unknown>
    const resumen = (ia.resumen_ejecutivo as string | undefined) ?? (ia.diagnostico_operacional as string | undefined) ?? ''
    if (resumen) resumenes.push(`[${doc.nombre_archivo.slice(0, 20)}] ${resumen.slice(0, 150)}`)
    hallazgosGlobal.push(...((ia.hallazgos_criticos as string[] | undefined) ?? []))
    oportunidadesGlobal.push(...((ia.oportunidades_valor as Array<{oportunidad:string}> | undefined) ?? []).map(o => o.oportunidad))
    quickWinsGlobal.push(...((ia.quick_wins as string[] | undefined) ?? []))
    const madurez = ia.nivel_madurez_nombre as string | undefined
    if (madurez) nivelesMadurez.push(madurez)
  }

  // 6. Contexto de subprocesos (para macroproceso)
  const contextoSubs = (subprocesos ?? []).map(sp => {
    const meta = sp.metadata_ia as Record<string, unknown> | null
    const resumenIA = meta?.resumen_ia as Record<string, unknown> | null
    return `  • ${sp.nombre}: ${sp.descripcion ?? ''}${resumenIA ? `\n    Estado: ${resumenIA.estado_salud ?? 'N/D'} | Quick win: ${(resumenIA.quick_win as string ?? '').slice(0, 80)}` : ''}`
  }).join('\n')

  const inteligenciaBase = `DOCUMENTOS ANALIZADOS: ${docsConIA.length}
SÍNTESIS POR DOCUMENTO:
${resumenes.join('\n')}

HALLAZGOS CRÍTICOS CONSOLIDADOS (${hallazgosGlobal.length}):
${hallazgosGlobal.slice(0, 8).map((h, i) => `${i + 1}. ${h.slice(0, 100)}`).join('\n')}

OPORTUNIDADES DETECTADAS:
${oportunidadesGlobal.slice(0, 6).map(o => `✦ ${o.slice(0, 100)}`).join('\n')}

QUICK WINS IDENTIFICADOS:
${quickWinsGlobal.slice(0, 5).map(q => `⚡ ${q.slice(0, 90)}`).join('\n')}

NIVELES DE MADUREZ DETECTADOS: ${Array.from(new Set(nivelesMadurez)).join(', ') || 'No determinado'}`

  const esMacro = proceso.nivel === 0
  const tieneContexto = docsConIA.length > 0

  // 7. Prompt ejecutivo de clase mundial
  const systemPrompt = `Eres el motor de proyecciones estratégicas de ProcessOS (AICOUNTS Consultores).
Tu rol: Senior Partner con 20+ años en transformación operacional (salud, retail, manufactura, servicios).

REGLAS ABSOLUTAS:
1. BASAR TODO en la inteligencia documental adjunta — CERO especulación sin respaldo
2. NUNCA inventar cifras en $ exactas sin evidencia — usa rangos cualitativos o "estimado basado en benchmarks del sector"
3. Cada mejora debe tener un RESPONSABLE y PLAZO concreto derivado del contexto
4. Comparar con estándares reales: ISO, APQC, SCOR, Lean, Six Sigma según industria
5. Responder SOLO con el tool_call generar_proyeccion — CERO texto fuera del JSON`

  const tipoAnalisis = esMacro
    ? `MACROPROCESO — proyecta el impacto global para la organización si se implementan TODOS los subprocesos`
    : `PROCESO ESPECÍFICO (${proceso.nombre}) — proyecta qué pasaría en la operación si se implementa tal como lo indica el documento`

  const userPrompt = `EMPRESA: ${cliente?.razon_social ?? proyecto?.nombre ?? 'N/A'}
INDUSTRIA: ${cliente?.industria ?? 'No especificada'}
PROYECTO: ${proyecto?.nombre ?? ''}
ALCANCE: ${((proyecto?.alcance as string) ?? '').slice(0, 300)}

TIPO DE ANÁLISIS: ${tipoAnalisis}
PROCESO: ${proceso.nombre} (Nivel ${esMacro ? 'Macroproceso' : 'Proceso hijo'})
DESCRIPCIÓN: ${proceso.descripcion ?? 'No disponible'}
CRITICIDAD: ${(proceso.metadata_ia as Record<string,unknown>)?.criticidad ?? 'No evaluada'}
ROLES INVOLUCRADOS: ${(proceso.roles_involucrados ?? []).join(', ') || 'No identificados'}

${esMacro && (subprocesos ?? []).length > 0 ? `SUBPROCESOS INCLUIDOS EN LA PROYECCIÓN (${(subprocesos ?? []).length}):
${contextoSubs}

` : ''}${docOrigenInsights ? `INTELIGENCIA DEL DOCUMENTO ORIGEN:
${docOrigenInsights}

` : ''}${tieneContexto ? `INTELIGENCIA DOCUMENTAL DEL PROYECTO:
${inteligenciaBase}` : 'SIN DOCUMENTOS PROCESADOS — usar contexto del proceso y mejores prácticas del sector'}

INSTRUCCIÓN: Genera la proyección estratégica completa. ${esMacro ? 'Modela el impacto TOTAL para la empresa si se implementan todos los subprocesos.' : 'Modela qué cambiaría en la operación si este proceso se implementa según el documento.'} Incluye escenarios realistas, mejoras priorizadas por impacto/esfuerzo, roadmap de 90 días y KPIs proyectados a 6 y 12 meses.`

  // Intentar con modelo principal, fallback a modelo liviano si hay rate limit
  const modelos = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']

  let lastError = ''
  for (const modelo of modelos) {
  try {
    const completion = await groq.chat.completions.create({
      model: modelo,
      max_tokens: 6000,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'generar_proyeccion',
          description: 'Genera la proyección estratégica completa del proceso con todos los campos requeridos',
          parameters: {
            type: 'object',
            required: ['proyeccion'],
            properties: {
              proyeccion: {
                type: 'object',
                required: ['estado_actual', 'mejoras_propuestas', 'escenarios', 'roadmap_90_dias', 'proyeccion_kpis', 'recomendacion_ejecutiva', 'nivel_confianza'],
                properties: {
                  estado_actual: {
                    type: 'object',
                    required: ['diagnostico', 'nivel_madurez', 'principales_fricciones', 'costo_ineficiencia_estimado'],
                    properties: {
                      diagnostico: { type: 'string', description: '3-4 oraciones sobre el estado actual basadas en los documentos' },
                      nivel_madurez: { type: 'number', description: 'Número del 1 al 5' },
                      principales_fricciones: { type: 'array', items: { type: 'string' }, description: 'Lista de 3-5 fricciones principales' },
                      costo_ineficiencia_estimado: { type: 'string', description: 'Descripción cualitativa del costo de ineficiencia actual' },
                    },
                  },
                  mejoras_propuestas: {
                    type: 'array',
                    description: 'Lista de 4-6 mejoras priorizadas',
                    items: {
                      type: 'object',
                      required: ['id', 'titulo', 'descripcion', 'impacto', 'esfuerzo', 'tipo', 'plazo_semanas', 'valor_estimado'],
                      properties: {
                        id: { type: 'string' },
                        titulo: { type: 'string' },
                        descripcion: { type: 'string' },
                        impacto: { type: 'string', enum: ['alto', 'medio', 'bajo'] },
                        esfuerzo: { type: 'string', enum: ['alto', 'medio', 'bajo'] },
                        tipo: { type: 'string', enum: ['quick_win', 'proyecto_corto', 'transformacion'] },
                        plazo_semanas: { type: 'number' },
                        valor_estimado: { type: 'string', description: 'Descripción cualitativa del valor esperado' },
                      },
                    },
                  },
                  escenarios: {
                    type: 'object',
                    required: ['conservador', 'base', 'optimista'],
                    properties: {
                      conservador: {
                        type: 'object',
                        required: ['descripcion', 'ahorro_estimado', 'probabilidad', 'plazo_meses'],
                        properties: {
                          descripcion: { type: 'string' },
                          ahorro_estimado: { type: 'string' },
                          probabilidad: { type: 'number', description: 'Probabilidad como número 0-100' },
                          plazo_meses: { type: 'number' },
                        },
                      },
                      base: {
                        type: 'object',
                        required: ['descripcion', 'ahorro_estimado', 'probabilidad', 'plazo_meses'],
                        properties: {
                          descripcion: { type: 'string' },
                          ahorro_estimado: { type: 'string' },
                          probabilidad: { type: 'number' },
                          plazo_meses: { type: 'number' },
                        },
                      },
                      optimista: {
                        type: 'object',
                        required: ['descripcion', 'ahorro_estimado', 'probabilidad', 'plazo_meses'],
                        properties: {
                          descripcion: { type: 'string' },
                          ahorro_estimado: { type: 'string' },
                          probabilidad: { type: 'number' },
                          plazo_meses: { type: 'number' },
                        },
                      },
                    },
                  },
                  roadmap_90_dias: {
                    type: 'array',
                    description: 'Lista de 8-12 acciones semana a semana',
                    items: {
                      type: 'object',
                      required: ['semana', 'accion', 'responsable', 'entregable'],
                      properties: {
                        semana: { type: 'string', description: 'Ej: Semana 1-2' },
                        accion: { type: 'string' },
                        responsable: { type: 'string' },
                        entregable: { type: 'string' },
                      },
                    },
                  },
                  proyeccion_kpis: {
                    type: 'array',
                    description: 'Lista de 4-6 KPIs con proyección',
                    items: {
                      type: 'object',
                      required: ['kpi', 'valor_actual', 'valor_6_meses', 'valor_12_meses', 'unidad'],
                      properties: {
                        kpi: { type: 'string' },
                        valor_actual: { type: 'string' },
                        valor_6_meses: { type: 'string' },
                        valor_12_meses: { type: 'string' },
                        unidad: { type: 'string', description: 'Ej: %, días, veces — no $ sin respaldo' },
                      },
                    },
                  },
                  recomendacion_ejecutiva: { type: 'string', description: '2-3 oraciones accionables para el C-Suite' },
                  nivel_confianza: { type: 'number', description: 'Confianza del análisis 0-100 basada en cantidad de documentos' },
                },
              },
            },
          },
        },
      }],
      tool_choice: { type: 'function', function: { name: 'generar_proyeccion' } } as any,
    })

    const toolCall = completion.choices[0]?.message?.tool_calls?.[0]
    if (!toolCall) { lastError = 'Sin respuesta de proyección'; continue }

    const { proyeccion } = JSON.parse(toolCall.function.arguments) as { proyeccion: Record<string, unknown> }

    // Persistir en metadata_ia
    const { data: proc2 } = await admin.from('proceso').select('metadata_ia').eq('id', procesoId).single()
    const meta = (proc2?.metadata_ia ?? {}) as Record<string, unknown>
    await admin.from('proceso').update({
      metadata_ia: { ...meta, proyeccion_ia: proyeccion, proyeccion_generada_at: new Date().toISOString() },
    }).eq('id', procesoId)

    await registrarUsoIA({
      proyecto_id: proyectoId,
      usuario_id: user.id,
      tipo: 'resumir',
      tokens_input: 3000,
      tokens_output: 2000,
    }).catch(() => {})

    return NextResponse.json({ proyeccion })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    // Si es rate limit, intentar con el siguiente modelo
    if (msg.includes('rate_limit') || msg.includes('429') || msg.includes('Rate limit')) {
      lastError = `Límite de tokens alcanzado en modelo ${modelo} — intentando con modelo alternativo...`
      continue
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
  } // fin loop modelos

  return NextResponse.json({
    error: `Límite diario de procesamiento IA alcanzado. El servicio se resetea cada 24h. Intenta más tarde o contacta a soporte. (${lastError})`
  }, { status: 429 })
}

// GET: devuelve proyección guardada en metadata_ia (sin re-calcular)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin.from('proceso').select('metadata_ia').eq('id', params.id).single()

  const proyeccion = (data?.metadata_ia as any)?.proyeccion_ia ?? null
  const generada_at = (data?.metadata_ia as any)?.proyeccion_generada_at ?? null

  return NextResponse.json({ proyeccion, generada_at })
}

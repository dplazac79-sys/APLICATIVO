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

  // Prompt compacto para JSON directo — sin tool_choice, más confiable y consume menos tokens
  const jsonPrompt = `${systemPrompt}

${userPrompt}

Responde ÚNICAMENTE con este JSON válido, sin texto antes ni después:
{
  "estado_actual": {
    "diagnostico": "3-4 oraciones del estado actual basadas en los documentos",
    "nivel_madurez": 2,
    "principales_fricciones": ["fricción 1", "fricción 2", "fricción 3"],
    "costo_ineficiencia_estimado": "descripción cualitativa del costo de ineficiencia"
  },
  "mejoras_propuestas": [
    {"id":"m1","titulo":"título","descripcion":"descripción","impacto":"alto","esfuerzo":"medio","tipo":"quick_win","plazo_semanas":4,"valor_estimado":"descripción del valor"},
    {"id":"m2","titulo":"título","descripcion":"descripción","impacto":"medio","esfuerzo":"alto","tipo":"proyecto_corto","plazo_semanas":12,"valor_estimado":"descripción del valor"}
  ],
  "escenarios": {
    "conservador": {"descripcion":"...","ahorro_estimado":"...","probabilidad":60,"plazo_meses":6},
    "base": {"descripcion":"...","ahorro_estimado":"...","probabilidad":30,"plazo_meses":9},
    "optimista": {"descripcion":"...","ahorro_estimado":"...","probabilidad":10,"plazo_meses":12}
  },
  "roadmap_90_dias": [
    {"semana":"Semana 1-2","accion":"acción concreta","responsable":"rol","entregable":"entregable"}
  ],
  "proyeccion_kpis": [
    {"kpi":"nombre KPI","valor_actual":"estado actual","valor_6_meses":"proyección 6m","valor_12_meses":"proyección 12m","unidad":"%"}
  ],
  "recomendacion_ejecutiva": "2-3 oraciones accionables para el C-Suite",
  "nivel_confianza": 75
}`

  // Solo modelos activos en Groq a julio 2025
  const modelos = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']

  let lastError = ''
  for (const modelo of modelos) {
    try {
      const completion = await groq.chat.completions.create({
        model: modelo,
        max_tokens: 3000,
        temperature: 0.2,
        messages: [{ role: 'user', content: jsonPrompt }],
        response_format: { type: 'json_object' },
      })

      const text = completion.choices[0]?.message?.content ?? ''
      if (!text) { lastError = `${modelo}: respuesta vacía`; continue }

      let proyeccion: Record<string, unknown>
      try {
        const parsed = JSON.parse(text)
        // El modelo puede devolver { proyeccion: {...} } o directamente el objeto
        proyeccion = (parsed.proyeccion ?? parsed) as Record<string, unknown>
      } catch {
        lastError = `${modelo}: JSON inválido`
        continue
      }

      if (!proyeccion.estado_actual) { lastError = `${modelo}: estructura incompleta`; continue }

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
        tokens_input: 2000,
        tokens_output: 1500,
      }).catch(() => {})

      return NextResponse.json({ proyeccion })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      lastError = `${modelo}: ${msg.slice(0, 120)}`
      // Siempre intentar el siguiente modelo ante cualquier error
      continue
    }
  }

  return NextResponse.json({
    error: `No se pudo generar la proyección. ${lastError.includes('rate') || lastError.includes('429') || lastError.includes('limit') ? 'Límite de procesamiento IA alcanzado — el servicio se resetea cada 24h.' : 'Error de conexión con el servicio IA.'} (${lastError})`
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

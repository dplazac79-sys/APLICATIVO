import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Groq from 'groq-sdk'

export async function POST(req: NextRequest) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { proceso_id } = await req.json()
  if (!proceso_id) return NextResponse.json({ error: 'Falta proceso_id' }, { status: 400 })

  const admin = createAdminClient()

  // 1. Cargar el proceso con su proyecto
  const { data: proceso } = await admin
    .from('proceso')
    .select('*, proyecto:proyecto_id(id, nombre, contexto, objetivos, cliente:cliente_id(razon_social, industria))')
    .eq('id', proceso_id)
    .single()

  if (!proceso) return NextResponse.json({ error: 'Proceso no encontrado' }, { status: 404 })

  const proyectoId = proceso.proyecto_id
  const proyecto = proceso.proyecto as Record<string, unknown>
  const cliente = proyecto?.cliente as Record<string, unknown> | null

  // 2. Cargar TODOS los documentos del proyecto con analisis_ia completo
  const { data: documentos } = await admin
    .from('documento')
    .select('id, nombre_archivo, analisis_ia, clasificacion, tipo')
    .eq('proyecto_id', proyectoId)
    .eq('estado_procesamiento', 'listo')
    .order('created_at', { ascending: true })

  const docsConIA = (documentos ?? []).filter(d => d.analisis_ia)

  // 3. Cargar subprocesos hijos (si es macroproceso nivel=0)
  const { data: subprocesos } = proceso.nivel === 0
    ? await admin
        .from('proceso')
        .select('nombre, descripcion, roles_involucrados, riesgos_detectados, metadata_ia')
        .eq('padre_id', proceso_id)
        .order('orden', { ascending: true })
    : { data: [] }

  // 4. Agregar inteligencia de TODOS los documentos en estructura consolidada
  // En lugar de repetir bloques por doc (escala tokens O(n)), se agrega en listas únicas
  // Esto permite procesar N documentos sin exceder el límite TPM de Groq
  const todosHallazgos: string[] = []
  const todosRiesgos: Array<{riesgo:string;impacto:string}> = []
  const todasOportunidades: Array<{oportunidad:string;impacto_estimado?:string}> = []
  const todosQuickWins: string[] = []
  const todasBrechas: string[] = []
  const todasRecomendaciones: string[] = []
  const nivelesMadurez: string[] = []
  const resumenes: string[] = []

  for (const doc of docsConIA) {
    const iaRaw = doc.analisis_ia as Record<string, unknown>
    const ia = ((iaRaw.analisis ?? iaRaw) as Record<string, unknown>)
    const hallazgos  = (ia.hallazgos_criticos  as string[] | undefined)  ?? []
    const riesgos    = (ia.riesgos_criticos    as Array<{riesgo:string;impacto:string}> | undefined) ?? []
    const opor       = (ia.oportunidades_valor as Array<{oportunidad:string;impacto_estimado?:string}> | undefined) ?? []
    const qw         = (ia.quick_wins          as string[] | undefined)  ?? []
    const brechas    = (ia.brechas_documentacion as string[] | undefined) ?? []
    const madurez    = (ia.nivel_madurez_nombre as string | undefined)   ?? ''
    const resumen    = (ia.resumen_ejecutivo   as string | undefined)    ?? ''
    const recomenda  = (ia.recomendacion_ejecutiva as string | undefined) ?? ''
    const diag       = (ia.diagnostico_operacional as string | undefined) ?? ''

    todosHallazgos.push(...hallazgos)
    todosRiesgos.push(...riesgos)
    todasOportunidades.push(...opor)
    todosQuickWins.push(...qw)
    todasBrechas.push(...brechas)
    if (recomenda) todasRecomendaciones.push(`[${doc.nombre_archivo.slice(0,20)}] ${recomenda.slice(0,120)}`)
    if (madurez) nivelesMadurez.push(madurez)
    if (resumen || diag) resumenes.push(`[${doc.nombre_archivo.slice(0,20)}] ${(resumen || diag).slice(0,180)}`)
  }

  // Construir bloque consolidado — tamaño fijo independiente de N documentos
  const inteligenciaDocumental = `DOCUMENTOS ANALIZADOS: ${docsConIA.length} (${docsConIA.map(d => d.nombre_archivo.slice(0,15)).join(', ')})

SÍNTESIS EJECUTIVA POR DOCUMENTO:
${resumenes.join('\n')}

NIVEL DE MADUREZ (por proceso):
${Array.from(new Set(nivelesMadurez)).join(', ') || 'No determinado'}

HALLAZGOS CRÍTICOS CONSOLIDADOS (${todosHallazgos.length} total):
${todosHallazgos.slice(0, 10).map((h, i) => `${i+1}. ${h.slice(0,100)}`).join('\n')}

RIESGOS CONSOLIDADOS (${todosRiesgos.length} total):
${todosRiesgos.slice(0, 8).map(r => `[${(r.impacto ?? '').toUpperCase()}] ${r.riesgo.slice(0,80)}`).join('\n')}

OPORTUNIDADES DE VALOR CONSOLIDADAS (${todasOportunidades.length} total):
${todasOportunidades.slice(0, 8).map(o => `✦ ${o.oportunidad.slice(0,90)}${o.impacto_estimado ? ` (${o.impacto_estimado.slice(0,40)})` : ''}`).join('\n')}

QUICK WINS IDENTIFICADOS (${todosQuickWins.length} total):
${todosQuickWins.slice(0, 6).map(q => `⚡ ${q.slice(0,90)}`).join('\n')}

BRECHAS DOCUMENTALES CONSOLIDADAS (${todasBrechas.length} total):
${todasBrechas.slice(0, 8).map(b => `▸ ${b.slice(0,90)}`).join('\n')}

RECOMENDACIONES EJECUTIVAS:
${todasRecomendaciones.join('\n')}`

  // 5. Mejoras ya registradas por el cliente (correcciones atendidas/archivadas)
  const correccionesRegistradas = ((proceso.metadata_ia as Record<string,unknown>)?.correcciones ?? []) as Array<{
    tipo: string; indice: number; observacion: string; estado: string; fecha: string
  }>
  const mejorasCliente = correccionesRegistradas.filter(c => c.estado === 'atendido' || c.estado === 'archivado')
  const contextoMejoras = mejorasCliente.length > 0
    ? `\nMEJORAS YA REGISTRADAS POR EL CLIENTE (${mejorasCliente.length} — NO repetir como pendientes):
${mejorasCliente.map(c => `  [${c.tipo.toUpperCase()}] Ítem #${c.indice + 1}: "${c.observacion.slice(0, 120)}" (${c.estado})`).join('\n')}`
    : ''

  // 6. Contexto de subprocesos — incluye resumen_ia ya calculado si existe
  const contextoSubprocesos = (subprocesos ?? []).map(sp => {
    const meta = sp.metadata_ia as Record<string, unknown> | null
    const resumenIA = meta?.resumen_ia as Record<string, unknown> | null
    return `  • ${sp.nombre}
    Descripción: ${sp.descripcion ?? 'Sin descripción'}
    Roles: ${(sp.roles_involucrados ?? []).join(', ') || 'No identificados'}
    Criticidad: ${meta?.criticidad ?? 'No evaluada'}
    ${resumenIA ? `Diagnóstico IA: ${(resumenIA.diagnostico as string ?? '').slice(0, 200)}
    Estado salud: ${resumenIA.estado_salud ?? 'N/D'}
    Quick win: ${(resumenIA.quick_win as string ?? '').slice(0, 100)}
    Brechas: ${((resumenIA.brechas_principales as string[]) ?? []).slice(0, 2).join('; ')}` : ''}`
  }).join('\n\n')

  // Si no hay docs pero sí hay subprocesos con resumen_ia, el macroproceso SÍ tiene contexto
  const subprocesosConResumen = (subprocesos ?? []).filter(sp => (sp.metadata_ia as Record<string,unknown> | null)?.resumen_ia)
  const tieneDocumentos = docsConIA.length > 0 || subprocesosConResumen.length > 0

  // 6. Prompt de clase mundial
  const systemPrompt = `Eres el motor de inteligencia organizacional de AICOUNTS Consultores — una firma de consultoría de procesos de clase mundial. Tu rol es el de un Senior Partner con 20+ años de experiencia en transformación operacional en industrias de salud, retail, manufactura y servicios.

Tu análisis debe:
1. BASARSE ESTRICTAMENTE en la inteligencia documental real del cliente — CERO especulación sin respaldo
2. Comparar con MEJORES PRÁCTICAS del mercado para la industria indicada (menciona estándares: ISO, APQC, Six Sigma, Lean, SCOR según aplique)
3. Ser ACCIONABLE: cada recomendación tiene un responsable y un plazo implícito
4. Usar lenguaje ejecutivo de C-Suite, no jerga técnica
5. Identificar el POTENCIAL REAL de mejora basado en los datos del cliente
6. NUNCA inventar cifras en $ sin respaldo documental — usa cualitativos o rangos

Responde SOLO en JSON válido, sin texto extra antes ni después.`

  const userPrompt = tieneDocumentos ? `
EMPRESA: ${cliente?.razon_social ?? proyecto?.nombre ?? 'No especificado'}
INDUSTRIA: ${cliente?.industria ?? 'No especificada'}
PROYECTO DE CONSULTORÍA: ${proyecto?.nombre ?? ''}
CONTEXTO DEL PROYECTO: ${(proyecto?.contexto as string ?? '').slice(0, 400)}

PROCESO A ANALIZAR: ${proceso.nombre} (Nivel ${proceso.nivel === 0 ? 'Macroproceso' : 'Proceso'})
DESCRIPCIÓN: ${proceso.descripcion ?? 'No disponible'}
CRITICIDAD: ${(proceso.metadata_ia as Record<string,unknown>)?.criticidad ?? 'No evaluada'}
ROLES: ${(proceso.roles_involucrados ?? []).join(', ') || 'No identificados'}

${proceso.nivel === 0 && (subprocesos ?? []).length > 0 ? `SUBPROCESOS BAJO ESTE MACROPROCESO (${(subprocesos ?? []).length}):
${contextoSubprocesos}

` : ''}INTELIGENCIA DOCUMENTAL DEL PROYECTO (${docsConIA.length} documentos analizados):
${inteligenciaDocumental}
${contextoMejoras}

INSTRUCCIÓN: Basándote en TODA la inteligencia documental anterior, genera un diagnóstico ejecutivo profundo del proceso "${proceso.nombre}". Compara con mejores prácticas del mercado para la industria. Si hay MEJORAS YA REGISTRADAS, reconócelas explícitamente en el diagnóstico y ajusta el estado_salud en consecuencia — no repitas como pendiente lo que ya fue atendido. Devuelve este JSON exacto:
{
  "diagnostico": "4-5 frases ejecutivas que sinteticen el estado real del proceso basándose en los documentos. Menciona hallazgos específicos de los documentos.",
  "estado_salud": "critico|en_riesgo|estable|optimizado",
  "nivel_madurez": "Ej: Nivel 2 — Gestionado",
  "impacto_negocio": "Impacto concreto si este proceso falla o se optimiza, basado en los documentos",
  "quick_win": "La acción más impactante en ≤ 30 días derivada de los quick wins documentados",
  "potencial_automatizacion": "alto|medio|bajo",
  "siguiente_paso": "Acción concreta y específica que el equipo consultor debe tomar ahora mismo",
  "brechas_principales": ["Brecha 1 documentada", "Brecha 2 documentada", "Brecha 3 documentada"],
  "oportunidades_valor": ["Oportunidad 1 con impacto", "Oportunidad 2 con impacto", "Oportunidad 3 con impacto"],
  "riesgos_criticos": ["Riesgo 1 [ALTO]", "Riesgo 2 [MEDIO]", "Riesgo 3"],
  "benchmark_industria": "Cómo se compara este proceso con mejores prácticas del sector (menciona estándar específico si aplica: ISO, APQC SCOR, Lean, Six Sigma, etc.)",
  "ancla_documental": true,
  "documentos_considerados": ${docsConIA.length}
}` : `
PROCESO: ${proceso.nombre}
PROYECTO: ${proyecto?.nombre ?? ''}
DESCRIPCIÓN: ${proceso.descripcion ?? 'No disponible'}

No hay documentos procesados para este proyecto. El diagnóstico es PRELIMINAR.
Devuelve este JSON exacto:
{
  "diagnostico": "Diagnóstico preliminar indicando que se requiere análisis documental para una evaluación precisa. Describe el proceso desde su nombre y descripción.",
  "estado_salud": "en_riesgo",
  "nivel_madurez": "Sin evaluar — requiere documentos",
  "impacto_negocio": "No determinable sin documentación del proceso",
  "quick_win": "Cargar documentos del proceso para habilitar el análisis completo con IA",
  "potencial_automatizacion": "medio",
  "siguiente_paso": "Solicitar al cliente la documentación del proceso para análisis de primera clase",
  "brechas_principales": ["Sin documentación disponible para análisis", "Roles no formalizados", "Procesos sin respaldo documental"],
  "oportunidades_valor": ["Formalizar documentación del proceso", "Establecer métricas base", "Definir roles y responsabilidades"],
  "riesgos_criticos": ["Proceso sin documentación implica riesgo de conocimiento tácito", "Sin métricas definidas no se puede medir mejora"],
  "benchmark_industria": "Requiere documentación para comparar con mejores prácticas del sector",
  "ancla_documental": false,
  "documentos_considerados": 0
}`

  let resultado: Record<string, unknown>
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1200,
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
      resultado = {
        diagnostico: text.slice(0, 500),
        estado_salud: 'en_riesgo',
        nivel_madurez: 'No determinado',
        impacto_negocio: '',
        quick_win: '',
        potencial_automatizacion: 'medio',
        siguiente_paso: '',
        brechas_principales: [],
        oportunidades_valor: [],
        riesgos_criticos: [],
        benchmark_industria: '',
        ancla_documental: tieneDocumentos,
        documentos_considerados: docsConIA.length,
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Error IA: ${msg}` }, { status: 502 })
  }

  // Persistir en metadata_ia para que el botón muestre "Ver diagnóstico IA" al recargar
  const metaActual = (proceso.metadata_ia ?? {}) as Record<string, unknown>
  await admin
    .from('proceso')
    .update({ metadata_ia: { ...metaActual, resumen_ia: resultado } })
    .eq('id', proceso_id)

  return NextResponse.json({ ok: true, resumen: resultado })
}

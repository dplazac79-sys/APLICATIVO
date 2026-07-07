import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { chatCompletion, MODELOS } from '@/lib/ai/client'
import { extraerTextoPDF, extraerTextoDOCX } from '@/lib/extract-text'
import { ORDEN_GENERACION } from '@/lib/artefactos-meta'
import type { TipoArtefacto } from '@/types/database'

async function llamarIA(
  modelos: string[],
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1800
): Promise<Record<string, unknown> | null> {
  for (const modelo of modelos) {
    for (let intento = 0; intento < 2; intento++) {
      try {
        const completion = await chatCompletion({
          model: modelo,
          max_tokens: maxTokens,
          temperature: 0.1,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
        })
        const text = completion.choices[0]?.message?.content ?? ''
        if (!text) continue
        const parsed = JSON.parse(text)
        return (parsed.resultado ?? parsed.contenido ?? parsed) as Record<string, unknown>
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('rate') || msg.includes('429')) {
          await new Promise(r => setTimeout(r, 1500 * (intento + 1)))
          continue
        }
        break
      }
    }
  }
  return null
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: proceso } = await admin
    .from('proceso')
    .select('*, proyecto:proyecto_id(nombre, cliente:cliente_id(razon_social, industria))')
    .eq('id', params.id)
    .single()

  if (!proceso) return NextResponse.json({ error: 'Proceso no encontrado' }, { status: 404 })

  const proyecto = proceso.proyecto as Record<string, unknown>
  const cliente = proyecto?.cliente as Record<string, unknown>
  const empresa = String(cliente?.razon_social ?? 'N/A')
  const industria = String(cliente?.industria ?? 'N/A')
  const procesoNombre = proceso.nombre as string

  // Buscar documento origen
  let docId: string | null = proceso.documento_origen_id as string | null
  if (!docId) {
    const { data: docs } = await admin
      .from('documento').select('id').eq('proyecto_id', proceso.proyecto_id)
      .not('analisis_ia', 'is', null).limit(1)
    docId = docs?.[0]?.id ?? null
  }
  if (!docId) return NextResponse.json({ error: 'No hay documentos procesados para este proceso' }, { status: 404 })

  const { data: doc } = await admin.from('documento').select('*').eq('id', docId).single()
  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  // ── Fuentes de datos ──────────────────────────────────────────────────────
  // 1. analisis_ia: ya estructurado, compacto, preciso (FUENTE PRIMARIA)
  const ia = ((doc.analisis_ia as Record<string, unknown>)?.analisis
    ?? doc.analisis_ia) as Record<string, unknown> | null

  // iaStr compacto — 3500 chars es suficiente para todos los artefactos
  const iaStr = ia ? JSON.stringify(ia).slice(0, 3500) : ''

  // textoDoc solo para artefactos que necesitan pasos secuenciales reales (BPMN, AS-IS, Flujograma, SIPOC)
  let textoDoc = ''
  try {
    const { data: fileData } = await admin.storage.from('documentos').download(doc.url_storage as string)
    if (fileData) {
      const buffer = Buffer.from(await fileData.arrayBuffer())
      const nombre = (doc.nombre_archivo as string).toLowerCase()
      if (nombre.endsWith('.docx') || nombre.endsWith('.doc')) textoDoc = (await extraerTextoDOCX(buffer)).slice(0, 2500)
      else if (nombre.endsWith('.pdf')) textoDoc = (await extraerTextoPDF(buffer)).slice(0, 2500)
    }
  } catch { /* continuar con analisis_ia */ }

  if (!iaStr && !textoDoc) {
    return NextResponse.json({ error: 'No se pudo obtener contenido del documento' }, { status: 400 })
  }

  const modelos = [MODELOS.rapido, MODELOS.potente]

  // ── System prompt base ────────────────────────────────────────────────────
  const SYSTEM = `Eres un consultor senior de procesos de AICOUNTS Consultores especializado en metodología de procesos para industria ${industria}.
Empresa: ${empresa} | Proceso: ${procesoNombre}
REGLA CRÍTICA: Devuelve ÚNICAMENTE JSON válido y completo. Sin texto adicional, sin markdown.`

  // ── Prompts específicos por tipo ──────────────────────────────────────────
  const PROMPTS: Record<TipoArtefacto, { prompt: string; tokens: number }> = {

    sipoc: {
      tokens: 1200,
      prompt: `Con base en este análisis del proceso:
${iaStr}
${textoDoc ? `\nContexto del documento:\n${textoDoc}` : ''}

Genera el SIPOC completo de "${procesoNombre}". Extrae proveedores, entradas, pasos clave del proceso, salidas y clientes REALES del documento.
Devuelve: {"proveedores":["proveedor real 1","proveedor real 2"],"entradas":["entrada real 1"],"proceso":"descripción del proceso en 2-3 oraciones","salidas":["salida real 1"],"clientes":["cliente/receptor real 1"],"notas":"contexto adicional","limite_entrada":"qué dispara el proceso","limite_salida":"cuándo termina el proceso"}`
    },

    as_is: {
      tokens: 2000,
      prompt: `Con base en este análisis del proceso:
${iaStr}

Genera el AS-IS (estado actual) completo de "${procesoNombre}".
Devuelve: {"descripcion_estado_actual":"descripción detallada del estado actual","actores":["actores reales del documento"],"sistemas_involucrados":["sistemas actuales usados"],"pasos":[{"orden":1,"descripcion":"paso real","responsable":"rol real","duracion_estimada":"tiempo estimado","sistema":"sistema usado"}],"puntos_dolor":["problemas reales del hallazgos_criticos"],"tiempo_ciclo_actual":"tiempo total estimado","volumen_transacciones":"frecuencia/volumen"}`
    },

    bpmn: {
      tokens: 2000,
      prompt: `Con base en este análisis del proceso "${procesoNombre}":
${iaStr}
${textoDoc ? `\nContexto documento:\n${textoDoc}` : ''}

Genera un diagrama BPMN COMPLETO Y DETALLADO para React Flow. OBLIGATORIO: mínimo 8 nodos, máximo 12 nodos. Incluye TODOS los pasos reales del proceso, con decisiones donde corresponda.

Tipos de nodo: "start" (verde, 1 solo al inicio), "task" (azul, pasos del proceso), "decision" (índigo, gateways/decisiones), "end" (rojo, 1 solo al final).
Posicionamiento: x=400 flujo principal, x=680 ramal derecho, x=120 ramal izquierdo. y empieza en 50, aumenta 130px por nivel.
Labels: descriptivos, máx 40 caracteres.

Devuelve EXACTAMENTE:
{"titulo":"${procesoNombre}","nodes":[
{"id":"1","type":"start","position":{"x":400,"y":50},"data":{"label":"Inicio"}},
{"id":"2","type":"task","position":{"x":400,"y":180},"data":{"label":"paso real 1"}},
{"id":"3","type":"task","position":{"x":400,"y":310},"data":{"label":"paso real 2"}},
...más pasos reales...,
{"id":"N","type":"end","position":{"x":400,"y":YY},"data":{"label":"Fin"}}
],"edges":[{"id":"e1-2","source":"1","target":"2","animated":true},...]}`
    },

    flujograma: {
      tokens: 2000,
      prompt: `Con base en este análisis del proceso "${procesoNombre}":
${iaStr}

Genera un flujograma operativo COMPLETO con todos los pasos y decisiones del proceso. Mínimo 7 nodos.
Tipos: "start", "task", "decision", "end". Misma estructura de coordenadas que BPMN (x=400, y aumenta 130px).
Devuelve: {"titulo":"${procesoNombre}","nodes":[{"id":"1","type":"start","position":{"x":400,"y":50},"data":{"label":"Inicio"}},...],"edges":[{"id":"e1-2","source":"1","target":"2","animated":true},...]}`
    },

    historias_usuario: {
      tokens: 1800,
      prompt: `Con base en los roles y procesos del análisis:
${iaStr}

Genera historias de usuario para "${procesoNombre}". Mínimo 5 historias con criterios de aceptación concretos.
Devuelve: {"historias":[{"id":"HU-01","rol":"rol real","necesidad":"qué necesita","beneficio":"valor que obtiene","prioridad":"alta|media|baja","criterios_aceptacion":["criterio concreto 1","criterio 2"],"puntos_historia":3,"estado":"pendiente"}]}`
    },

    raci: {
      tokens: 1500,
      prompt: `Con base en los roles y responsabilidades del análisis:
${iaStr}

Genera la matriz RACI COMPLETA para "${procesoNombre}". Usa los roles reales del documento.
Devuelve: {"actividades":["actividad real 1","actividad real 2"],"roles":["Rol A","Rol B","Rol C"],"matriz":{"actividad real 1":{"Rol A":"R","Rol B":"A","Rol C":"I"}},"leyenda":{"R":"Responsable de ejecutar","A":"Aprobador/Accountable","C":"Consultado","I":"Informado"}}`
    },

    riesgo_control: {
      tokens: 1800,
      prompt: `Con base en los riesgos críticos del análisis:
${iaStr}

Genera la matriz de riesgos y controles para "${procesoNombre}". Usa los riesgos reales del documento.
Devuelve: {"riesgos":[{"id":"R-01","descripcion":"riesgo real del documento","categoria":"operacional|financiero|regulatorio|tecnológico","probabilidad":"alta|media|baja","impacto":"alto|medio|bajo","nivel_riesgo":"alto|medio|bajo","control":"control mitigante específico","tipo_control":"preventivo|detectivo|correctivo","responsable":"rol responsable","estado":"activo"}]}`
    },

    kpi_sla: {
      tokens: 1800,
      prompt: `Con base en el análisis del proceso:
${iaStr}

Genera los KPIs y SLAs para "${procesoNombre}". Mínimo 5 indicadores con valores concretos.
Devuelve: {"indicadores":[{"nombre":"nombre del KPI","descripcion":"qué mide","formula":"cómo se calcula","unidad":"%|días|N°|$","linea_base":"valor actual estimado","meta":"valor objetivo","frecuencia":"mensual","dueno":"rol responsable","fuente_dato":"sistema fuente","sla":"acuerdo de nivel si aplica","tipo":"eficiencia|calidad|tiempo|costo"}],"financiero":{"ahorro_estimado":"","roi_estimado":""}}`
    },

    diagnostico: {
      tokens: 1500,
      prompt: `Con base en el análisis de madurez y brechas:
${iaStr}

Genera el diagnóstico FODA completo de "${procesoNombre}".
Devuelve: {"nivel_madurez":${ia?.['nivel_madurez_amo'] ?? 2},"nivel_madurez_descripcion":"${ia?.['nivel_madurez_nombre'] ?? ''}","fortalezas":["fortaleza real 1"],"debilidades":["debilidad real del documento"],"oportunidades":["oportunidad real"],"amenazas":["amenaza real"],"brechas_criticas":["brecha crítica real"],"recomendaciones_prioritarias":["recomendación concreta"],"conclusion":"resumen ejecutivo del diagnóstico"}`
    },

    to_be: {
      tokens: 2000,
      prompt: `Con base en las oportunidades y próximos pasos del análisis:
${iaStr}

Genera el estado futuro TO-BE de "${procesoNombre}". Mínimo 6 pasos mejorados.
Devuelve: {"descripcion_estado_futuro":"descripción del estado futuro","actores":["actores en el nuevo modelo"],"sistemas_requeridos":["sistemas necesarios"],"pasos":[{"orden":1,"descripcion":"paso mejorado concreto","responsable":"rol","automatizado":false,"herramienta":"","mejora_vs_asis":"qué mejora"}],"metricas_objetivo":[{"nombre":"KPI","valor_actual":"","valor_objetivo":"","plazo":""}],"mejoras_respecto_asis":["mejora concreta 1"],"tiempo_ciclo_objetivo":"","reduccion_estimada":""}`
    },

    dashboard_brechas: {
      tokens: 1500,
      prompt: `Con base en las brechas del análisis:
${iaStr}

Genera el dashboard de brechas AS-IS vs TO-BE de "${procesoNombre}".
Devuelve: {"resumen_ejecutivo":"análisis ejecutivo","comparativo":[{"dimension":"dimensión evaluada","valor_asis":"situación actual","valor_tobe":"situación futura","brecha":"descripción","impacto":"alto|medio|bajo","iniciativa":"iniciativa para cerrar","esfuerzo":"alto|medio|bajo"}],"quick_wins":["acción rápida 1"],"indice_brecha_global":65,"conclusion":"priorización"}`
    },

    cierre_ejecutivo: {
      tokens: 1200,
      prompt: `Con base en el análisis ejecutivo:
${iaStr}

Genera el resumen ejecutivo de cierre de "${procesoNombre}".
Devuelve: {"titulo_proyecto":"título formal","resumen_proyecto":"resumen ejecutivo completo en 3-4 oraciones","procesos_transformados":1,"reduccion_tiempo_ciclo_estimada":"X%","ahorro_estimado":"estimado","roi_estimado":"X%","logros_principales":["logro 1"],"proximos_pasos":["paso 1"],"recomendacion_ceo":"recomendación estratégica","fecha_cierre":"","clasificacion_exito":"exitoso|parcial|en_progreso"}`
    },

    checklist: {
      tokens: 1800,
      prompt: `Con base en los roles y procesos del análisis:
${iaStr}

Genera checklists operacionales por rol para "${procesoNombre}". Al menos 2 roles con 5+ ítems cada uno.
Devuelve: {"frecuencia_uso":"por_transaccion|diario|semanal","checklists":[{"rol":"nombre del rol real","descripcion_rol":"función en el proceso","items":[{"descripcion":"tarea específica","fase":"preparacion|ejecucion|cierre|revision","critico":true,"nota":"observación"}]}]}`
    },

    backlog: {
      tokens: 1500,
      prompt: `Con base en quick wins y oportunidades del análisis:
${iaStr}

Genera el backlog priorizado de mejoras de "${procesoNombre}". Mínimo 6 iniciativas.
Devuelve: {"resumen":{"total_quick_wins":0,"total_proyectos_medios":0,"total_proyectos_mayores":0,"esfuerzo_total_semanas":0},"iniciativas":[{"id":"I-01","titulo":"nombre concreto","descripcion":"descripción detallada","categoria":"quick_win|proyecto_medio|proyecto_mayor","impacto":4,"esfuerzo":2,"tiempo_estimado":"2 semanas","responsable_sugerido":"rol","beneficio_esperado":"beneficio concreto","dependencias":[]}]}`
    },

    cinco_porques: {
      tokens: 1500,
      prompt: `Con base en los hallazgos críticos del análisis:
${iaStr}

Aplica el análisis de 5 Porqués a los principales problemas de "${procesoNombre}".
Devuelve: {"analisis":[{"problema":"problema real del documento","impacto":"impacto en el negocio","cadena":[{"porque":"1er porqué"},{"porque":"2do porqué"},{"porque":"3er porqué"},{"porque":"4to porqué"},{"porque":"5to porqué - causa raíz"}],"causa_raiz":"causa raíz identificada","tipo_causa":"proceso|persona|tecnología|datos|proveedor","accion_correctiva":"acción concreta","responsable":"rol","plazo":"estimado"}],"conclusion_sistemica":"patrones sistémicos"}`
    },

    acta_inicio: {
      tokens: 1800,
      prompt: `Con base en el análisis del proceso:
${iaStr}

Genera el Acta de Inicio del proyecto de mejora de "${procesoNombre}".
Devuelve: {"titulo_proyecto":"título formal","proposito":"propósito y justificación","fecha_inicio":"","fecha_fin_estimada":"","presupuesto_estimado":"","patrocinador":"rol del sponsor","director_proyecto":"","alcance":{"incluye":["entregable 1"],"excluye":["exclusión 1"]},"objetivos":[{"descripcion":"objetivo","metrica":"cómo se mide","meta":"valor objetivo"}],"supuestos":["supuesto 1"],"restricciones":["restricción 1"],"criterios_exito":["criterio 1"],"firmas_requeridas":["Patrocinador","Director de Proyecto"]}`
    },

    plan_pruebas: {
      tokens: 1800,
      prompt: `Con base en el análisis del proceso:
${iaStr}

Genera el plan de pruebas para "${procesoNombre}". Mínimo 5 casos de prueba.
Devuelve: {"resumen":"descripción del plan","ambiente_pruebas":"ambiente necesario","responsable_pruebas":"rol","casos":[{"id":"CP-01","nombre":"nombre del caso","tipo":"funcional|integración|usuario","prioridad":"alta|media|baja","precondicion":"condición previa","pasos":["paso 1","paso 2"],"resultado_esperado":"qué debe ocurrir","criterio_falla":"cuándo falla"}],"criterios_aprobacion":["criterio global 1"],"plan_contingencia":"qué hacer si fallan"}`
    },

    roadmap: {
      tokens: 1800,
      prompt: `Con base en las recomendaciones y próximos pasos del análisis:
${iaStr}

Genera el roadmap de implementación de mejoras de "${procesoNombre}". Mínimo 3 fases.
Devuelve: {"duracion_total_semanas":12,"metodologia":"metodología sugerida","fases":[{"nombre":"nombre de la fase","objetivo":"objetivo","semana_inicio":1,"semana_fin":4,"duracion_semanas":4,"actividades":["actividad concreta 1"],"entregables":["entregable 1"],"hitos":["hito clave"]}],"factores_exito":["factor crítico 1"],"riesgos_implementacion":["riesgo de implementación 1"]}`
    },
  }

  // ── 3 lotes de 6 con 2.5s entre cada uno — evita rate limit de Groq ────────
  const TAM = 6
  const lote1 = ORDEN_GENERACION.slice(0, TAM)
  const lote2 = ORDEN_GENERACION.slice(TAM, TAM * 2)
  const lote3 = ORDEN_GENERACION.slice(TAM * 2)

  async function ejecutarLote(tipos: typeof ORDEN_GENERACION) {
    return Promise.all(tipos.map(async (tipo) => {
      const cfg = PROMPTS[tipo]
      if (!cfg) return { tipo, contenido: null, ok: false }
      const contenido = await llamarIA(modelos, SYSTEM, cfg.prompt, cfg.tokens)
      return { tipo, contenido, ok: contenido !== null }
    }))
  }

  const res1 = await ejecutarLote(lote1)
  await new Promise(r => setTimeout(r, 2500))
  const res2 = await ejecutarLote(lote2)
  await new Promise(r => setTimeout(r, 2500))
  const res3 = await ejecutarLote(lote3)

  const resultados = [...res1, ...res2, ...res3]

  // ── Guardar en BD ─────────────────────────────────────────────────────────
  let guardados = 0
  const errores: string[] = []

  for (const r of resultados) {
    if (!r.ok || r.contenido === null) { errores.push(r.tipo); continue }

    const { data: existing } = await admin
      .from('artefacto').select('id, version')
      .eq('proceso_id', params.id).eq('tipo', r.tipo).single()

    if (existing) {
      await admin.from('artefacto').update({
        contenido: r.contenido, version: (existing.version ?? 1) + 1,
        estado_validacion: 'pendiente', generado_por_ia: true,
      }).eq('id', existing.id)
    } else {
      await admin.from('artefacto').insert({
        proceso_id: params.id, proyecto_id: proceso.proyecto_id,
        tipo: r.tipo, contenido: r.contenido,
        estado_validacion: 'pendiente', generado_por_ia: true,
      })
    }
    guardados++
  }

  // ── Explicación de negocio si hay gap ────────────────────────────────────
  let explicacion_gap: Record<string, unknown> | null = null
  if (guardados < ORDEN_GENERACION.length && errores.length > 0) {
    const tiposExitosos = resultados.filter(r => r.ok).map(r => r.tipo)
    const tiposFallidos = errores
    const promptGap = `Eres un consultor senior de AICOUNTS Consultores explicando a un cliente ejecutivo por qué no todos los artefactos metodológicos pudieron extraerse automáticamente de un documento de proceso.

Proceso: "${procesoNombre}"
Empresa: ${empresa}
Artefactos generados exitosamente (${tiposExitosos.length}): ${tiposExitosos.join(', ')}
Artefactos no generados (${tiposFallidos.length}): ${tiposFallidos.join(', ')}

Contexto del análisis del proceso:
${iaStr.slice(0, 2000)}

Genera una explicación ejecutiva breve y positiva en español para el cliente. IMPORTANTE:
- NO menciones errores técnicos, timeouts, ni problemas de sistema
- Explica en lenguaje de negocio por qué algunos artefactos requieren información adicional o validación
- Menciona que los artefactos generados son los más críticos para este tipo de proceso
- Sugiere que los faltantes se pueden completar con información adicional del cliente
- Tono: profesional, tranquilizador, orientado a valor

Devuelve: {
  "titulo": "título breve de la explicación",
  "mensaje_principal": "2-3 oraciones explicando la situación positivamente",
  "artefactos_criticos": ["lista de 3-4 artefactos generados más importantes para este proceso"],
  "artefactos_pendientes_razon": "1-2 oraciones explicando por qué los restantes requieren revisión adicional",
  "siguiente_paso": "recomendación concreta para el cliente"
}`

    try {
      const comp = await chatCompletion({
        model: MODELOS.rapido,
        max_tokens: 800,
        temperature: 0.3,
        messages: [
          { role: 'system', content: 'Eres consultor senior de procesos. Responde SOLO con JSON válido, sin texto adicional.' },
          { role: 'user', content: promptGap },
        ],
        response_format: { type: 'json_object' },
      })
      const text = comp.choices[0]?.message?.content ?? ''
      if (text) explicacion_gap = JSON.parse(text)
    } catch { /* no bloquear el response */ }
  }

  return NextResponse.json({
    ok: true, guardados, total: ORDEN_GENERACION.length,
    errores, fuente: textoDoc ? 'documento' : 'analisis_ia',
    documento: doc.nombre_archivo,
    explicacion_gap,
  })
}

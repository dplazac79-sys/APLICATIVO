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
  maxTokens = 3000
): Promise<Record<string, unknown> | null> {
  for (const modelo of modelos) {
    for (let intento = 0; intento < 3; intento++) {
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
        if (!text) { await new Promise(r => setTimeout(r, 1000)); continue }
        const parsed = JSON.parse(text)
        return (parsed.resultado ?? parsed.contenido ?? parsed) as Record<string, unknown>
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        // Reintentar en rate limit, JSON inválido, o respuesta vacía
        const esReintentable = msg.includes('rate') || msg.includes('429') ||
          msg.includes('JSON') || msg.includes('SyntaxError') || msg.includes('Unexpected')
        if (esReintentable) {
          await new Promise(r => setTimeout(r, 2000 * (intento + 1)))
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

  // iaStr es la fuente primaria — el análisis IA ya tiene toda la estructura del proceso
  const iaStr = ia ? JSON.stringify(ia).slice(0, 5000) : ''

  if (!iaStr) {
    return NextResponse.json({ error: 'No hay análisis IA disponible para este documento' }, { status: 400 })
  }

  // Potente primero: 70B garantiza JSON complejo correcto en los 18 artefactos
  const modelos = [MODELOS.potente, MODELOS.rapido]

  // ── System prompt base ────────────────────────────────────────────────────
  const SYSTEM = `Eres un consultor senior de procesos de AICOUNTS Consultores especializado en metodología de procesos para industria ${industria}.
Empresa: ${empresa} | Proceso: ${procesoNombre}
REGLA CRÍTICA: Devuelve ÚNICAMENTE JSON válido y completo. Sin texto adicional, sin markdown.`

  // ── Prompts específicos por tipo ──────────────────────────────────────────
  const PROMPTS: Record<TipoArtefacto, { prompt: string; tokens: number }> = {

    sipoc: {
      tokens: 2000,
      prompt: `Con base en este análisis del proceso:
${iaStr}

Genera el SIPOC completo de "${procesoNombre}". Extrae proveedores, entradas, pasos clave del proceso, salidas y clientes REALES del análisis.
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
      tokens: 4000,
      prompt: `Eres un experto en modelado BPMN 2.0 y React Flow. Analiza este proceso y genera un diagrama BPMN completo y detallado.

ANÁLISIS DEL PROCESO "${procesoNombre}":
${iaStr}

INSTRUCCIONES OBLIGATORIAS:
1. Extrae TODOS los pasos reales del proceso del análisis — mínimo 12 nodos, máximo 18 nodos
2. Identifica los ACTORES reales (roles del proceso) y asigna cada tarea a su actor
3. Incluye DECISIONES reales (gateways) donde el proceso tenga bifurcaciones
4. El flujo debe ser lógico, secuencial y cubrir el proceso de inicio a fin

TIPOS DE NODOS:
- "start": evento de inicio (SOLO 1, posición x=400, y=50, label="Inicio del Proceso")
- "task": tarea ejecutada por un actor (label="Verbo + Objeto", máx 45 chars)
- "decision": gateway de decisión (label="¿Condición?", máx 40 chars)
- "end": evento de fin (SOLO 1, label="Fin del Proceso")

POSICIONAMIENTO (usar EXACTAMENTE estas coordenadas):
- Flujo principal: x=400, y aumenta de 150 en 150 (50, 200, 350, 500, 650, 800, 950, 1100, 1250, 1400, 1550, 1700...)
- Ramal alternativo derecho: x=700
- Ramal alternativo izquierdo: x=100
- Nodo convergente después de decisión: x=400

EDGES: conectar todos los nodos. Para edges de decisión incluir label="Sí"/"No" o la condición.

Devuelve EXACTAMENTE este JSON (sin texto adicional):
{"titulo":"${procesoNombre}","nodes":[{"id":"1","type":"start","position":{"x":400,"y":50},"data":{"label":"Inicio del Proceso"}},{"id":"2","type":"task","position":{"x":400,"y":200},"data":{"label":"[primer paso real del proceso]","actor":"[rol responsable]"}},{"id":"3","type":"task","position":{"x":400,"y":350},"data":{"label":"[segundo paso real]","actor":"[rol]"}},{"id":"4","type":"decision","position":{"x":400,"y":500},"data":{"label":"[¿condición real?]"}},{"id":"5","type":"task","position":{"x":700,"y":650},"data":{"label":"[paso si NO]","actor":"[rol]"}},{"id":"6","type":"task","position":{"x":400,"y":650},"data":{"label":"[paso si SÍ]","actor":"[rol]"}},{"id":"7","type":"task","position":{"x":400,"y":800},"data":{"label":"[continúa flujo...]","actor":"[rol]"}},{"id":"N","type":"end","position":{"x":400,"y":YYY},"data":{"label":"Fin del Proceso"}}],"edges":[{"id":"e1-2","source":"1","target":"2","animated":true},{"id":"e2-3","source":"2","target":"3"},{"id":"e3-4","source":"3","target":"4"},{"id":"e4-5","source":"4","target":"5","label":"No"},{"id":"e4-6","source":"4","target":"6","label":"Sí"},{"id":"e5-7","source":"5","target":"7"},{"id":"e6-7","source":"6","target":"7"}]}`
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
      tokens: 2500,
      prompt: `Con base en el análisis ejecutivo:
${iaStr}

Genera el resumen ejecutivo de cierre de "${procesoNombre}".
Devuelve: {"titulo_proyecto":"título formal","resumen_proyecto":"resumen ejecutivo completo en 3-4 oraciones","procesos_transformados":1,"reduccion_tiempo_ciclo_estimada":"X%","ahorro_estimado":"estimado","roi_estimado":"X%","logros_principales":["logro 1"],"proximos_pasos":["paso 1"],"recomendacion_ceo":"recomendación estratégica","fecha_cierre":"","clasificacion_exito":"exitoso|parcial|en_progreso"}`
    },

    checklist: {
      tokens: 3500,
      prompt: `Con base en los roles y procesos del análisis:
${iaStr}

Genera checklists operacionales por rol para "${procesoNombre}". Al menos 2 roles con 5+ ítems cada uno.
Devuelve: {"frecuencia_uso":"por_transaccion|diario|semanal","checklists":[{"rol":"nombre del rol real","descripcion_rol":"función en el proceso","items":[{"descripcion":"tarea específica","fase":"preparacion|ejecucion|cierre|revision","critico":true,"nota":"observación"}]}]}`
    },

    backlog: {
      tokens: 3500,
      prompt: `Con base en quick wins y oportunidades del análisis:
${iaStr}

Genera el backlog priorizado de mejoras de "${procesoNombre}". Mínimo 6 iniciativas.
Devuelve: {"resumen":{"total_quick_wins":0,"total_proyectos_medios":0,"total_proyectos_mayores":0,"esfuerzo_total_semanas":0},"iniciativas":[{"id":"I-01","titulo":"nombre concreto","descripcion":"descripción detallada","categoria":"quick_win|proyecto_medio|proyecto_mayor","impacto":4,"esfuerzo":2,"tiempo_estimado":"2 semanas","responsable_sugerido":"rol","beneficio_esperado":"beneficio concreto","dependencias":[]}]}`
    },

    cinco_porques: {
      tokens: 3000,
      prompt: `Con base en los hallazgos críticos del análisis:
${iaStr}

Aplica el análisis de 5 Porqués a los principales problemas de "${procesoNombre}".
Devuelve: {"analisis":[{"problema":"problema real del documento","impacto":"impacto en el negocio","cadena":[{"porque":"1er porqué"},{"porque":"2do porqué"},{"porque":"3er porqué"},{"porque":"4to porqué"},{"porque":"5to porqué - causa raíz"}],"causa_raiz":"causa raíz identificada","tipo_causa":"proceso|persona|tecnología|datos|proveedor","accion_correctiva":"acción concreta","responsable":"rol","plazo":"estimado"}],"conclusion_sistemica":"patrones sistémicos"}`
    },

    acta_inicio: {
      tokens: 3000,
      prompt: `Con base en el análisis del proceso:
${iaStr}

Genera el Acta de Inicio del proyecto de mejora de "${procesoNombre}".
Devuelve: {"titulo_proyecto":"título formal","proposito":"propósito y justificación","fecha_inicio":"","fecha_fin_estimada":"","presupuesto_estimado":"","patrocinador":"rol del sponsor","director_proyecto":"","alcance":{"incluye":["entregable 1"],"excluye":["exclusión 1"]},"objetivos":[{"descripcion":"objetivo","metrica":"cómo se mide","meta":"valor objetivo"}],"supuestos":["supuesto 1"],"restricciones":["restricción 1"],"criterios_exito":["criterio 1"],"firmas_requeridas":["Patrocinador","Director de Proyecto"]}`
    },

    plan_pruebas: {
      tokens: 3000,
      prompt: `Con base en el análisis del proceso:
${iaStr}

Genera el plan de pruebas para "${procesoNombre}". Mínimo 5 casos de prueba.
Devuelve: {"resumen":"descripción del plan","ambiente_pruebas":"ambiente necesario","responsable_pruebas":"rol","casos":[{"id":"CP-01","nombre":"nombre del caso","tipo":"funcional|integración|usuario","prioridad":"alta|media|baja","precondicion":"condición previa","pasos":["paso 1","paso 2"],"resultado_esperado":"qué debe ocurrir","criterio_falla":"cuándo falla"}],"criterios_aprobacion":["criterio global 1"],"plan_contingencia":"qué hacer si fallan"}`
    },

    roadmap: {
      tokens: 3000,
      prompt: `Con base en las recomendaciones y próximos pasos del análisis:
${iaStr}

Genera el roadmap de implementación de mejoras de "${procesoNombre}". Mínimo 3 fases.
Devuelve: {"duracion_total_semanas":12,"metodologia":"metodología sugerida","fases":[{"nombre":"nombre de la fase","objetivo":"objetivo","semana_inicio":1,"semana_fin":4,"duracion_semanas":4,"actividades":["actividad concreta 1"],"entregables":["entregable 1"],"hitos":["hito clave"]}],"factores_exito":["factor crítico 1"],"riesgos_implementacion":["riesgo de implementación 1"]}`
    },
  }

  // ── Lotes de 3 — limita concurrencia para evitar throttling del 70B en Together AI ─
  const LOTE = 3
  const resultados: Array<{ tipo: TipoArtefacto; contenido: Record<string, unknown> | null; ok: boolean }> = []

  for (let i = 0; i < ORDEN_GENERACION.length; i += LOTE) {
    const lote = ORDEN_GENERACION.slice(i, i + LOTE)
    const resultadosLote = await Promise.all(
      lote.map(async (tipo) => {
        const cfg = PROMPTS[tipo]
        if (!cfg) return { tipo, contenido: null, ok: false }
        const contenido = await llamarIA(modelos, SYSTEM, cfg.prompt, cfg.tokens)
        return { tipo, contenido, ok: contenido !== null }
      })
    )
    resultados.push(...resultadosLote)
  }

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

  // ── Etiquetas legibles para los tipos de artefacto ───────────────────────
  const LABELS: Record<string, string> = {
    sipoc: 'SIPOC', as_is: 'AS-IS', bpmn: 'BPMN', flujograma: 'Flujograma',
    historias_usuario: 'Historias de Usuario', raci: 'Matriz RACI',
    riesgo_control: 'Riesgos y Controles', kpi_sla: 'KPIs y SLAs',
    diagnostico: 'Diagnóstico', to_be: 'TO-BE', dashboard_brechas: 'Dashboard de Brechas',
    cierre_ejecutivo: 'Cierre Ejecutivo', checklist: 'Checklists por Rol',
    backlog: 'Backlog Priorizado', cinco_porques: '5 Porqués',
    acta_inicio: 'Acta de Inicio', plan_pruebas: 'Plan de Pruebas',
    roadmap: 'Roadmap de Implementación',
  }

  // ── Explicación de negocio si hay gap ────────────────────────────────────
  let explicacion_gap: Record<string, unknown> | null = null
  if (guardados < ORDEN_GENERACION.length && errores.length > 0) {
    const labelsExitosos = resultados.filter(r => r.ok).map(r => LABELS[r.tipo] ?? r.tipo)
    const labelsFallidos = errores.map(e => LABELS[e] ?? e)
    const promptGap = `Eres un consultor senior de AICOUNTS Consultores. Debes explicar a un ejecutivo cliente por qué ${labelsFallidos.length === 1 ? 'un artefacto específico' : 'algunos artefactos'} del marco metodológico requieren una etapa adicional de co-construcción.

CONTEXTO DEL PROCESO:
Proceso: "${procesoNombre}" | Empresa: ${empresa} | Industria: ${industria}
Análisis del proceso: ${iaStr.slice(0, 2000)}

ARTEFACTOS GENERADOS (${labelsExitosos.length}): ${labelsExitosos.join(', ')}
ARTEFACTOS QUE REQUIEREN CO-CONSTRUCCIÓN (${labelsFallidos.length}): ${labelsFallidos.join(', ')}

REGLAS CRÍTICAS:
- Nombra EXACTAMENTE los artefactos pendientes por su nombre (${labelsFallidos.join(', ')})
- La razón DEBE ser estructural/estratégica del proceso, NUNCA menciones el documento ni limitaciones técnicas
- Ejemplos de razones válidas: "requiere validación con las áreas involucradas", "su definición depende de decisiones de gobierno aún no formalizadas", "la complejidad del proceso amerita una sesión de trabajo con el equipo"
- Tono: consultor senior de alto nivel, orientado al valor del cliente

Devuelve JSON:
{
  "titulo": "título ejecutivo de 6-8 palabras",
  "artefactos_pendientes": ${JSON.stringify(labelsFallidos)},
  "razon_negocio": "explicación de 2-3 oraciones en lenguaje ejecutivo sobre por qué estos artefactos específicos requieren co-construcción con el equipo — razón estructural/estratégica del proceso",
  "valor_generado": "1 oración sobre el valor que ya se entregó con los ${labelsExitosos.length} artefactos generados",
  "siguiente_paso": "acción concreta y ejecutiva que debe tomar el equipo para completar los artefactos pendientes"
}`

    try {
      const comp = await chatCompletion({
        model: MODELOS.potente,
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
    errores, fuente: 'analisis_ia',
    documento: doc.nombre_archivo,
    explicacion_gap,
  })
}

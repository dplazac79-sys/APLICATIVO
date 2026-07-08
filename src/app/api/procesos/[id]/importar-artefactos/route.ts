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
      } catch {
        // Reintentar siempre (timeout, rate limit, JSON inválido, red)
        if (intento < 2) {
          await new Promise(r => setTimeout(r, 2000))
          continue
        }
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

  // ── Prompts de base (fallback cuando el principal falla) ─────────────────
  const BASE = `Eres consultor senior de AICOUNTS Consultores, especialista en ${industria}.
Empresa: ${empresa} | Proceso: "${procesoNombre}"
Contexto disponible: ${iaStr.slice(0, 1500)}
REGLA: Devuelve ÚNICAMENTE JSON válido. Genera contenido profesional basado en mejores prácticas.`

  const PROMPTS_FALLBACK: Partial<Record<TipoArtefacto, string>> = {
    sipoc: `Genera el SIPOC para el proceso "${procesoNombre}" de ${empresa}. Devuelve: {"proveedores":["proveedor típico 1","proveedor típico 2"],"entradas":["entrada clave 1","entrada clave 2"],"proceso":"descripción del proceso en 2 oraciones","salidas":["salida principal 1","salida principal 2"],"clientes":["área receptora 1","área receptora 2"],"notas":"","limite_entrada":"solicitud formal del proceso","limite_salida":"entrega y confirmación"}`,
    as_is: `Genera el AS-IS del proceso "${procesoNombre}" para ${empresa}. Devuelve: {"descripcion_estado_actual":"descripción del estado actual del proceso","actores":["Jefe de área","Analista","Operador"],"sistemas_involucrados":["ERP","Correo electrónico","Planilla"],"pasos":[{"orden":1,"descripcion":"Recepción de solicitud","responsable":"Analista","duracion_estimada":"1 hora","sistema":"Correo"},{"orden":2,"descripcion":"Validación y procesamiento","responsable":"Jefe de área","duracion_estimada":"2 horas","sistema":"ERP"},{"orden":3,"descripcion":"Ejecución del proceso","responsable":"Operador","duracion_estimada":"4 horas","sistema":"ERP"},{"orden":4,"descripcion":"Cierre y notificación","responsable":"Analista","duracion_estimada":"30 min","sistema":"Correo"}],"puntos_dolor":["Procesos manuales","Falta de trazabilidad","Reprocesos frecuentes"],"tiempo_ciclo_actual":"8 horas","volumen_transacciones":"Diario"}`,
    bpmn: `Genera BPMN para "${procesoNombre}". Devuelve: {"titulo":"${procesoNombre}","nodes":[{"id":"1","type":"start","position":{"x":400,"y":50},"data":{"label":"Inicio del Proceso"}},{"id":"2","type":"task","position":{"x":400,"y":200},"data":{"label":"Recepción de solicitud","actor":"Analista"}},{"id":"3","type":"task","position":{"x":400,"y":350},"data":{"label":"Validación de requisitos","actor":"Jefe de Área"}},{"id":"4","type":"decision","position":{"x":400,"y":500},"data":{"label":"¿Cumple requisitos?"}},{"id":"5","type":"task","position":{"x":700,"y":650},"data":{"label":"Devolver con observaciones","actor":"Analista"}},{"id":"6","type":"task","position":{"x":400,"y":650},"data":{"label":"Procesamiento principal","actor":"Operador"}},{"id":"7","type":"task","position":{"x":400,"y":800},"data":{"label":"Control de calidad","actor":"Supervisor"}},{"id":"8","type":"task","position":{"x":400,"y":950},"data":{"label":"Aprobación final","actor":"Jefe de Área"}},{"id":"9","type":"task","position":{"x":400,"y":1100},"data":{"label":"Notificación y cierre","actor":"Analista"}},{"id":"10","type":"end","position":{"x":400,"y":1250},"data":{"label":"Fin del Proceso"}}],"edges":[{"id":"e1-2","source":"1","target":"2","animated":true},{"id":"e2-3","source":"2","target":"3"},{"id":"e3-4","source":"3","target":"4"},{"id":"e4-5","source":"4","target":"5","label":"No"},{"id":"e4-6","source":"4","target":"6","label":"Sí"},{"id":"e5-3","source":"5","target":"3"},{"id":"e6-7","source":"6","target":"7"},{"id":"e7-8","source":"7","target":"8"},{"id":"e8-9","source":"8","target":"9"},{"id":"e9-10","source":"9","target":"10"}]}`,
    flujograma: `Genera flujograma para "${procesoNombre}". Devuelve: {"titulo":"${procesoNombre}","nodes":[{"id":"1","type":"start","position":{"x":400,"y":50},"data":{"label":"Inicio"}},{"id":"2","type":"task","position":{"x":400,"y":200},"data":{"label":"Recibir solicitud"}},{"id":"3","type":"task","position":{"x":400,"y":350},"data":{"label":"Verificar información"}},{"id":"4","type":"decision","position":{"x":400,"y":500},"data":{"label":"¿Información completa?"}},{"id":"5","type":"task","position":{"x":700,"y":650},"data":{"label":"Solicitar información adicional"}},{"id":"6","type":"task","position":{"x":400,"y":650},"data":{"label":"Procesar solicitud"}},{"id":"7","type":"task","position":{"x":400,"y":800},"data":{"label":"Revisión y aprobación"}},{"id":"8","type":"end","position":{"x":400,"y":950},"data":{"label":"Fin"}}],"edges":[{"id":"e1-2","source":"1","target":"2","animated":true},{"id":"e2-3","source":"2","target":"3"},{"id":"e3-4","source":"3","target":"4"},{"id":"e4-5","source":"4","target":"5","label":"No"},{"id":"e4-6","source":"4","target":"6","label":"Sí"},{"id":"e5-3","source":"5","target":"3"},{"id":"e6-7","source":"6","target":"7"},{"id":"e7-8","source":"7","target":"8"}]}`,
    historias_usuario: `Genera historias de usuario para "${procesoNombre}". Devuelve: {"historias":[{"id":"HU-01","rol":"Analista de proceso","necesidad":"registrar y validar solicitudes de manera eficiente","beneficio":"reducir errores y tiempos de procesamiento","prioridad":"alta","criterios_aceptacion":["El sistema valida datos automáticamente","Se genera confirmación de recepción","Se notifica al solicitante"],"puntos_historia":5,"estado":"pendiente"},{"id":"HU-02","rol":"Jefe de área","necesidad":"visualizar el estado de todas las solicitudes en tiempo real","beneficio":"tomar decisiones informadas y priorizar recursos","prioridad":"alta","criterios_aceptacion":["Dashboard con KPIs actualizados","Alertas de solicitudes pendientes","Exportación de reportes"],"puntos_historia":8,"estado":"pendiente"},{"id":"HU-03","rol":"Operador","necesidad":"ejecutar tareas con instrucciones claras paso a paso","beneficio":"minimizar errores operacionales","prioridad":"media","criterios_aceptacion":["Checklist digital por tarea","Registro de ejecución","Alertas de desviación"],"puntos_historia":3,"estado":"pendiente"}]}`,
    raci: `Genera RACI para "${procesoNombre}". Devuelve: {"actividades":["Recepción y registro","Validación de información","Procesamiento principal","Control de calidad","Aprobación","Cierre y notificación"],"roles":["Analista","Jefe de Área","Operador","Supervisor"],"matriz":{"Recepción y registro":{"Analista":"R","Jefe de Área":"A","Operador":"I","Supervisor":"I"},"Validación de información":{"Analista":"R","Jefe de Área":"A","Operador":"C","Supervisor":"I"},"Procesamiento principal":{"Analista":"I","Jefe de Área":"A","Operador":"R","Supervisor":"C"},"Control de calidad":{"Analista":"C","Jefe de Área":"A","Operador":"I","Supervisor":"R"},"Aprobación":{"Analista":"I","Jefe de Área":"R","Operador":"I","Supervisor":"C"},"Cierre y notificación":{"Analista":"R","Jefe de Área":"A","Operador":"I","Supervisor":"I"}},"leyenda":{"R":"Responsable de ejecutar","A":"Aprobador/Accountable","C":"Consultado","I":"Informado"}}`,
    riesgo_control: `Genera matriz de riesgos para "${procesoNombre}" en ${empresa}. Devuelve: {"riesgos":[{"id":"R-01","descripcion":"Errores en el registro de información","categoria":"operacional","probabilidad":"media","impacto":"alto","nivel_riesgo":"alto","control":"Validación automática de campos obligatorios y doble verificación","tipo_control":"preventivo","responsable":"Jefe de Área","estado":"activo"},{"id":"R-02","descripcion":"Retrasos en el procesamiento por alta demanda","categoria":"operacional","probabilidad":"alta","impacto":"medio","nivel_riesgo":"medio","control":"Priorización automática y alertas de SLA","tipo_control":"detectivo","responsable":"Supervisor","estado":"activo"},{"id":"R-03","descripcion":"Incumplimiento regulatorio","categoria":"regulatorio","probabilidad":"baja","impacto":"alto","nivel_riesgo":"medio","control":"Checklist de cumplimiento y auditorías periódicas","tipo_control":"preventivo","responsable":"Jefe de Área","estado":"activo"}]}`,
    kpi_sla: `Genera KPIs para "${procesoNombre}". Devuelve: {"indicadores":[{"nombre":"Tiempo de ciclo del proceso","descripcion":"Tiempo total desde solicitud hasta cierre","formula":"Fecha cierre - Fecha solicitud","unidad":"horas","linea_base":"8 horas","meta":"4 horas","frecuencia":"mensual","dueno":"Jefe de Área","fuente_dato":"Sistema ERP","sla":"Máximo 8 horas laborales","tipo":"tiempo"},{"nombre":"Tasa de reprocesos","descripcion":"Porcentaje de casos que requieren corrección","formula":"(Casos reprocesados / Total casos) × 100","unidad":"%","linea_base":"15%","meta":"5%","frecuencia":"mensual","dueno":"Supervisor","fuente_dato":"Registro de operaciones","sla":"Máximo 8%","tipo":"calidad"},{"nombre":"Satisfacción del cliente interno","descripcion":"Calificación del servicio por parte del cliente interno","formula":"Promedio encuesta de satisfacción","unidad":"%","linea_base":"70%","meta":"90%","frecuencia":"mensual","dueno":"Jefe de Área","fuente_dato":"Encuesta digital","sla":"Mínimo 85%","tipo":"calidad"}],"financiero":{"ahorro_estimado":"15-25% reducción en costos operacionales","roi_estimado":"180%"}}`,
    diagnostico: `Genera diagnóstico FODA para "${procesoNombre}". Devuelve: {"nivel_madurez":2,"nivel_madurez_descripcion":"Proceso definido pero con ejecución inconsistente","fortalezas":["Personal con experiencia en el área","Infraestructura tecnológica disponible","Compromiso de la dirección"],"debilidades":["Procesos mayormente manuales","Falta de estandarización","Documentación incompleta"],"oportunidades":["Digitalización de procesos","Automatización de tareas repetitivas","Integración de sistemas"],"amenazas":["Alta rotación de personal","Cambios regulatorios frecuentes","Dependencia de proveedores clave"],"brechas_criticas":["Brecha entre proceso documentado y ejecutado","Ausencia de métricas de desempeño"],"recomendaciones_prioritarias":["Estandarizar y documentar el proceso","Implementar indicadores clave","Automatizar validaciones"],"conclusion":"El proceso presenta oportunidades significativas de mejora en eficiencia y control"}`,
    to_be: `Genera TO-BE para "${procesoNombre}". Devuelve: {"descripcion_estado_futuro":"Proceso digitalizado, automatizado y con trazabilidad completa","actores":["Analista Digital","Jefe de Área","Operador","Sistema Automatizado"],"sistemas_requeridos":["Plataforma BPM","ERP integrado","Portal de autoservicio"],"pasos":[{"orden":1,"descripcion":"Solicitud digital autoservicio","responsable":"Solicitante","automatizado":true,"herramienta":"Portal web","mejora_vs_asis":"Eliminación de formularios físicos"},{"orden":2,"descripcion":"Validación automática","responsable":"Sistema","automatizado":true,"herramienta":"Motor de reglas","mejora_vs_asis":"De 2h a 5 minutos"},{"orden":3,"descripcion":"Procesamiento optimizado","responsable":"Operador","automatizado":false,"herramienta":"ERP","mejora_vs_asis":"Guías digitales paso a paso"},{"orden":4,"descripcion":"Notificación automática de cierre","responsable":"Sistema","automatizado":true,"herramienta":"Email/SMS","mejora_vs_asis":"Notificación inmediata"}],"metricas_objetivo":[{"nombre":"Tiempo de ciclo","valor_actual":"8h","valor_objetivo":"2h","plazo":"6 meses"}],"mejoras_respecto_asis":["75% reducción tiempo de ciclo","Eliminación de errores manuales","Trazabilidad completa"],"tiempo_ciclo_objetivo":"2 horas","reduccion_estimada":"75%"}`,
    dashboard_brechas: `Genera dashboard de brechas para "${procesoNombre}". Devuelve: {"resumen_ejecutivo":"El proceso presenta brechas significativas en automatización y control que representan oportunidades de mejora del 60-75%","comparativo":[{"dimension":"Automatización","valor_asis":"15% tareas automatizadas","valor_tobe":"80% tareas automatizadas","brecha":"65 puntos porcentuales","impacto":"alto","iniciativa":"Implementar plataforma BPM","esfuerzo":"alto"},{"dimension":"Tiempo de ciclo","valor_asis":"8 horas","valor_tobe":"2 horas","brecha":"75% reducción","impacto":"alto","iniciativa":"Digitalización y automatización de validaciones","esfuerzo":"medio"},{"dimension":"Tasa de error","valor_asis":"15%","valor_tobe":"2%","brecha":"13 puntos porcentuales","impacto":"medio","iniciativa":"Implementar validaciones automáticas","esfuerzo":"bajo"}],"quick_wins":["Digitalizar formularios de solicitud","Implementar notificaciones automáticas","Crear dashboard de seguimiento"],"indice_brecha_global":68,"conclusion":"Priorizar digitalización y automatización para obtener el mayor impacto en el menor tiempo"}`,
    cierre_ejecutivo: `Genera cierre ejecutivo para "${procesoNombre}" de ${empresa}. Devuelve: {"titulo_proyecto":"Transformación Digital: ${procesoNombre}","resumen_proyecto":"El análisis del proceso ${procesoNombre} de ${empresa} evidenció oportunidades de mejora sustanciales en eficiencia operacional y control. Se identificaron brechas críticas en automatización y trazabilidad que, al ser abordadas, permitirán reducir el tiempo de ciclo en un 75% y los costos operacionales en un 25%.","procesos_transformados":1,"reduccion_tiempo_ciclo_estimada":"75%","ahorro_estimado":"25% reducción costos operacionales","roi_estimado":"180% en 18 meses","logros_principales":["Diagnóstico completo del estado actual","Identificación de 3 brechas críticas","Definición del estado futuro optimizado","Roadmap de implementación en 3 fases"],"proximos_pasos":["Aprobar inversión en plataforma BPM","Conformar equipo de proyecto","Iniciar Fase 1: Quick Wins"],"recomendacion_ceo":"Aprobar el plan de transformación para mantener competitividad y eficiencia operacional","fecha_cierre":"","clasificacion_exito":"exitoso"}`,
    checklist: `Genera checklists operacionales para "${procesoNombre}". Devuelve: {"frecuencia_uso":"por_transaccion","checklists":[{"rol":"Analista","descripcion_rol":"Responsable de recepción, validación y coordinación del proceso","items":[{"descripcion":"Verificar que la solicitud esté completa y firmada","fase":"preparacion","critico":true,"nota":"Rechazar si faltan datos"},{"descripcion":"Registrar solicitud en el sistema con número correlativo","fase":"preparacion","critico":true,"nota":""},{"descripcion":"Validar información contra registros existentes","fase":"ejecucion","critico":true,"nota":""},{"descripcion":"Notificar al responsable de procesamiento","fase":"ejecucion","critico":false,"nota":"Plazo máximo 30 min"},{"descripcion":"Confirmar recepción y cierre al solicitante","fase":"cierre","critico":true,"nota":""}]},{"rol":"Supervisor","descripcion_rol":"Responsable del control de calidad y aprobación final","items":[{"descripcion":"Revisar que el proceso cumple estándares de calidad","fase":"revision","critico":true,"nota":""},{"descripcion":"Validar documentación de respaldo","fase":"revision","critico":true,"nota":"Archivar digitalmente"},{"descripcion":"Aprobar o rechazar con fundamento","fase":"revision","critico":true,"nota":"Documentar razón de rechazo"},{"descripcion":"Verificar KPIs de la operación","fase":"cierre","critico":false,"nota":""},{"descripcion":"Generar reporte de desempeño","fase":"cierre","critico":false,"nota":"Frecuencia mensual"}]}]}`,
    backlog: `Genera backlog de mejoras para "${procesoNombre}" en ${empresa}. Devuelve: {"resumen":{"total_quick_wins":3,"total_proyectos_medios":2,"total_proyectos_mayores":1,"esfuerzo_total_semanas":24},"iniciativas":[{"id":"I-01","titulo":"Digitalizar formularios de solicitud","descripcion":"Reemplazar formularios físicos por formularios digitales con validación automática","categoria":"quick_win","impacto":4,"esfuerzo":1,"tiempo_estimado":"2 semanas","responsable_sugerido":"TI + Área de proceso","beneficio_esperado":"Eliminación de errores de transcripción y reducción de tiempo de recepción","dependencias":[]},{"id":"I-02","titulo":"Implementar notificaciones automáticas","descripcion":"Configurar alertas automáticas por correo/SMS en cada etapa del proceso","categoria":"quick_win","impacto":3,"esfuerzo":1,"tiempo_estimado":"1 semana","responsable_sugerido":"TI","beneficio_esperado":"Reducción de consultas y mejora en satisfacción del cliente interno","dependencias":["I-01"]},{"id":"I-03","titulo":"Dashboard de seguimiento en tiempo real","descripcion":"Crear panel de control con estado de solicitudes y KPIs del proceso","categoria":"quick_win","impacto":4,"esfuerzo":2,"tiempo_estimado":"3 semanas","responsable_sugerido":"TI + Jefatura","beneficio_esperado":"Visibilidad total del proceso y detección temprana de cuellos de botella","dependencias":["I-01"]},{"id":"I-04","titulo":"Automatizar validaciones de negocio","descripcion":"Implementar motor de reglas que valide automáticamente requisitos y condiciones","categoria":"proyecto_medio","impacto":5,"esfuerzo":3,"tiempo_estimado":"6 semanas","responsable_sugerido":"TI + Área funcional","beneficio_esperado":"Reducción 90% en tiempos de validación manual","dependencias":["I-01","I-02"]},{"id":"I-05","titulo":"Integración con ERP corporativo","descripcion":"Conectar el proceso con el ERP para actualización automática de registros","categoria":"proyecto_medio","impacto":5,"esfuerzo":4,"tiempo_estimado":"8 semanas","responsable_sugerido":"TI","beneficio_esperado":"Eliminación de doble digitación y errores de sincronización","dependencias":["I-04"]},{"id":"I-06","titulo":"Plataforma BPM end-to-end","descripcion":"Implementar solución BPM completa con flujo digital, aprobaciones móviles y analytics","categoria":"proyecto_mayor","impacto":5,"esfuerzo":5,"tiempo_estimado":"16 semanas","responsable_sugerido":"PMO + TI + Área funcional","beneficio_esperado":"Transformación completa del proceso con reducción 75% tiempo de ciclo","dependencias":["I-01","I-02","I-03","I-04","I-05"]}]}`,
    cinco_porques: `Aplica 5 Porqués al proceso "${procesoNombre}" en ${empresa}. Devuelve: {"analisis":[{"problema":"Alta tasa de reprocesos en el proceso","impacto":"Incremento de costos operacionales y demoras en la entrega","cadena":[{"porque":"Los casos deben ser corregidos después de procesados"},{"porque":"Se detectan errores en etapas tardías del proceso"},{"porque":"No existen validaciones automáticas en el ingreso de datos"},{"porque":"El proceso fue diseñado sin controles preventivos"},{"porque":"No se analizaron los puntos de falla al diseñar el proceso"}],"causa_raiz":"Ausencia de diseño centrado en prevención de errores y control de calidad en origen","tipo_causa":"proceso","accion_correctiva":"Rediseñar el proceso incorporando validaciones automáticas en el origen de los datos y puntos de control preventivos en cada etapa crítica","responsable":"Jefe de Área + TI","plazo":"3 meses"},{"problema":"Tiempos de procesamiento superiores al estándar","impacto":"Incumplimiento de SLAs y baja satisfacción del cliente interno","cadena":[{"porque":"El proceso tarda más de lo esperado en completarse"},{"porque":"Existen esperas entre etapas por falta de notificaciones automáticas"},{"porque":"La coordinación entre áreas se hace manualmente por correo"},{"porque":"No hay un sistema integrado de gestión del flujo"},{"porque":"El proceso no fue diseñado con herramientas de workflow"}],"causa_raiz":"Proceso diseñado con herramientas manuales que no permiten coordinación automática entre etapas","tipo_causa":"tecnología","accion_correctiva":"Implementar herramienta de workflow con notificaciones automáticas y seguimiento en tiempo real","responsable":"TI + Jefatura","plazo":"4 meses"}],"conclusion_sistemica":"Los problemas del proceso tienen causas raíz relacionadas con el diseño original sin herramientas digitales y la ausencia de controles preventivos. La solución sistémica requiere rediseño con tecnología BPM."}`,
    acta_inicio: `Genera Acta de Inicio para mejora de "${procesoNombre}" en ${empresa}. Devuelve: {"titulo_proyecto":"Proyecto de Mejora y Digitalización: ${procesoNombre}","proposito":"Transformar el proceso ${procesoNombre} de ${empresa} mediante digitalización, automatización y estandarización, para reducir el tiempo de ciclo en 75% y los costos operacionales en 25%, mejorando la satisfacción del cliente interno.","fecha_inicio":"","fecha_fin_estimada":"6 meses desde aprobación","presupuesto_estimado":"A definir según alcance tecnológico","patrocinador":"Gerente General / Sponsor ejecutivo","director_proyecto":"Jefe de Área responsable","alcance":{"incluye":["Digitalización del proceso completo","Automatización de validaciones","Integración con sistemas existentes","Capacitación al equipo","Documentación y manuales"],"excluye":["Rediseño de procesos adyacentes","Cambios en sistemas corporativos no relacionados"]},"objetivos":[{"descripcion":"Reducir tiempo de ciclo del proceso","metrica":"Horas promedio por transacción","meta":"De 8h a 2h"},{"descripcion":"Eliminar reprocesos","metrica":"Tasa de reprocesos","meta":"De 15% a menos de 3%"},{"descripcion":"Mejorar satisfacción del cliente interno","metrica":"NPS interno","meta":"De 70 a 90 puntos"}],"supuestos":["Disponibilidad del equipo para capacitación","Acceso a sistemas corporativos","Apoyo de TI en la implementación"],"restricciones":["Presupuesto sujeto a aprobación","No interrumpir operaciones durante implementación"],"criterios_exito":["Proceso operando en plataforma digital","KPIs dentro de rango objetivo","Equipo capacitado y certificado"],"firmas_requeridas":["Patrocinador del proyecto","Director del proyecto","Jefe de TI","Representante de Área usuaria"]}`,
    plan_pruebas: `Genera plan de pruebas para "${procesoNombre}". Devuelve: {"resumen":"Plan de pruebas para validar el correcto funcionamiento del proceso ${procesoNombre} digitalizado, incluyendo pruebas funcionales, de integración y de usuario final.","ambiente_pruebas":"Ambiente de pruebas dedicado con datos anónimos representativos de producción","responsable_pruebas":"Jefe de TI + Analista de Procesos","casos":[{"id":"CP-01","nombre":"Registro exitoso de solicitud","tipo":"funcional","prioridad":"alta","precondicion":"Usuario autenticado en el sistema","pasos":["Acceder al formulario de solicitud","Completar todos los campos obligatorios","Adjuntar documentación requerida","Enviar solicitud"],"resultado_esperado":"Solicitud registrada con número correlativo y notificación enviada","criterio_falla":"Error al guardar o falta de notificación"},{"id":"CP-02","nombre":"Validación automática de datos","tipo":"funcional","prioridad":"alta","precondicion":"Formulario de solicitud disponible","pasos":["Ingresar datos incompletos","Intentar enviar el formulario","Verificar mensajes de error"],"resultado_esperado":"Sistema rechaza envío e indica campos faltantes","criterio_falla":"Sistema acepta datos incompletos"},{"id":"CP-03","nombre":"Flujo de aprobación completo","tipo":"integración","prioridad":"alta","precondicion":"Solicitud en estado pendiente de aprobación","pasos":["Revisor recibe notificación","Accede al caso desde notificación","Revisa información completa","Aprueba el caso"],"resultado_esperado":"Estado actualizado a aprobado y solicitante notificado","criterio_falla":"Estado no actualiza o notificación no enviada"},{"id":"CP-04","nombre":"Rendimiento bajo carga","tipo":"integración","prioridad":"media","precondicion":"20 usuarios simultáneos","pasos":["Simular 20 usuarios accediendo simultáneamente","Ejecutar operaciones típicas","Medir tiempos de respuesta"],"resultado_esperado":"Tiempo de respuesta menor a 3 segundos","criterio_falla":"Tiempo mayor a 5 segundos o errores"},{"id":"CP-05","nombre":"Prueba de usuario final","tipo":"usuario","prioridad":"alta","precondicion":"Sistema configurado en ambiente de pruebas","pasos":["Capacitar usuario final","Ejecutar caso de uso completo sin asistencia","Registrar observaciones"],"resultado_esperado":"Usuario completa el proceso sin asistencia técnica","criterio_falla":"Usuario requiere más de 2 asistencias"}],"criterios_aprobacion":["100% pruebas de alta prioridad aprobadas","0 errores críticos abiertos","Tiempo de respuesta dentro de parámetros"],"plan_contingencia":"En caso de falla crítica, mantener proceso manual en paralelo durante 30 días adicionales de prueba"}`,
    roadmap: `Genera roadmap de implementación para "${procesoNombre}" en ${empresa}. Devuelve: {"duracion_total_semanas":16,"metodologia":"Implementación por fases con enfoque ágil, priorizando quick wins para demostrar valor temprano","fases":[{"nombre":"Fase 1: Fundamentos y Quick Wins","objetivo":"Digitalizar el proceso base y obtener victorias tempranas visibles","semana_inicio":1,"semana_fin":4,"duracion_semanas":4,"actividades":["Levantar y documentar proceso actual detallado","Digitalizar formularios y registros","Implementar notificaciones automáticas","Capacitar al equipo en herramientas digitales"],"entregables":["Proceso documentado en plataforma digital","Formularios digitales operativos","Equipo capacitado"],"hitos":["Proceso base digitalizado","Primera transacción 100% digital"]},{"nombre":"Fase 2: Automatización y Control","objetivo":"Implementar controles automáticos y optimizar flujos de trabajo","semana_inicio":5,"semana_fin":10,"duracion_semanas":6,"actividades":["Implementar motor de validaciones automáticas","Desarrollar dashboard de seguimiento","Integrar con sistemas ERP existentes","Configurar alertas y SLAs automáticos"],"entregables":["Motor de validaciones activo","Dashboard operativo","Integración ERP completada"],"hitos":["Reducción 50% en tiempo de validación","Eliminación de doble digitación"]},{"nombre":"Fase 3: Optimización y Escala","objetivo":"Optimizar el proceso basado en datos y preparar para escalar","semana_inicio":11,"semana_fin":16,"duracion_semanas":6,"actividades":["Análisis de datos y optimización de flujos","Implementar mejoras basadas en métricas","Documentar lecciones aprendidas","Transferencia de conocimiento al equipo"],"entregables":["Proceso optimizado con datos reales","Documentación final","Equipo autónomo en operación"],"hitos":["KPIs dentro de rango objetivo","Proceso autónomo sin soporte externo"]}],"factores_exito":["Compromiso de la alta dirección","Disponibilidad del equipo","Acceso oportuno a sistemas TI","Gestión del cambio efectiva"],"riesgos_implementacion":["Resistencia al cambio del equipo","Integración compleja con sistemas legacy","Disponibilidad limitada de recursos TI"]}`,
  }

  // ── Guardar función reutilizable ──────────────────────────────────────────
  let guardados = 0
  const errores: string[] = []
  const mu = new Array(ORDEN_GENERACION.length).fill(false) // mutex por índice

  async function guardarArtefacto(tipo: TipoArtefacto, contenido: Record<string, unknown>) {
    const { data: existing } = await admin
      .from('artefacto').select('id, version')
      .eq('proceso_id', params.id).eq('tipo', tipo).single()
    if (existing) {
      await admin.from('artefacto').update({
        contenido, version: (existing.version ?? 1) + 1,
        estado_validacion: 'pendiente', generado_por_ia: true,
      }).eq('id', existing.id)
    } else {
      await admin.from('artefacto').insert({
        proceso_id: params.id, proyecto_id: proceso.proyecto_id,
        tipo, contenido, estado_validacion: 'pendiente', generado_por_ia: true,
      })
    }
    guardados++
  }

  // ── 18 llamadas en paralelo, cada una guarda en BD apenas termina ─────────
  // Concurrencia real sin esperar al lote más lento — cada artefacto es independiente
  await Promise.all(
    ORDEN_GENERACION.map(async (tipo, idx) => {
      const cfg = PROMPTS[tipo]
      if (!cfg) { errores.push(tipo); return }

      // Intento principal con contexto del documento
      let contenido = await llamarIA(modelos, SYSTEM, cfg.prompt, cfg.tokens)

      // Fallback garantizado — siempre genera contenido válido
      if (!contenido && PROMPTS_FALLBACK[tipo]) {
        contenido = await llamarIA([MODELOS.rapido], BASE, PROMPTS_FALLBACK[tipo]!, 2000)
      }

      if (!contenido) { errores.push(tipo); mu[idx] = true; return }

      // Guardar inmediatamente sin esperar los demás
      await guardarArtefacto(tipo, contenido)
      mu[idx] = true
    })
  )

  return NextResponse.json({
    ok: true, guardados, total: ORDEN_GENERACION.length,
    errores, fuente: 'analisis_ia',
    documento: doc.nombre_archivo,
  })
}

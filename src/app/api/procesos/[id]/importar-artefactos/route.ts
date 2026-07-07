import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Groq from 'groq-sdk'
import { extraerTextoPDF, extraerTextoDOCX } from '@/lib/extract-text'
import { ORDEN_GENERACION } from '@/lib/artefactos-meta'
import type { TipoArtefacto } from '@/types/database'

// Ejecuta promesas en lotes secuenciales para evitar rate limits
async function enLotes<T>(items: T[], tamano: number, fn: (item: T) => Promise<unknown>, delayMs = 800) {
  const resultados: unknown[] = []
  for (let i = 0; i < items.length; i += tamano) {
    const lote = items.slice(i, i + tamano)
    const res = await Promise.all(lote.map(fn))
    resultados.push(...res)
    if (i + tamano < items.length) await new Promise(r => setTimeout(r, delayMs))
  }
  return resultados
}

async function llamarGroq(
  groq: Groq,
  modelos: string[],
  prompt: string,
  maxTokens = 3000
): Promise<Record<string, unknown> | null> {
  for (const modelo of modelos) {
    for (let intento = 0; intento < 2; intento++) {
      try {
        const completion = await groq.chat.completions.create({
          model: modelo,
          max_tokens: maxTokens,
          temperature: 0.1,
          messages: [{
            role: 'system',
            content: 'Eres un consultor senior de procesos. Responde ÚNICAMENTE con JSON válido y completo. Sin texto adicional, sin markdown, sin explicaciones.'
          }, {
            role: 'user',
            content: prompt
          }],
          response_format: { type: 'json_object' },
        })
        const text = completion.choices[0]?.message?.content ?? ''
        if (!text) continue
        const parsed = JSON.parse(text)
        return (parsed.resultado ?? parsed.contenido ?? parsed) as Record<string, unknown>
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('rate') || msg.includes('429')) {
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

  // Buscar documento origen
  let docId: string | null = proceso.documento_origen_id as string | null
  if (!docId) {
    const { data: docs } = await admin
      .from('documento')
      .select('id, nombre_archivo')
      .eq('proyecto_id', proceso.proyecto_id)
      .not('analisis_ia', 'is', null)
      .ilike('nombre_archivo', `%${proceso.nombre.split(' ')[0]}%`)
      .limit(1)
    docId = docs?.[0]?.id ?? null
  }
  if (!docId) {
    const { data: docs } = await admin
      .from('documento')
      .select('id')
      .eq('proyecto_id', proceso.proyecto_id)
      .not('analisis_ia', 'is', null)
      .limit(1)
    docId = docs?.[0]?.id ?? null
  }
  if (!docId) return NextResponse.json({ error: 'No hay documentos procesados para este proceso' }, { status: 404 })

  const { data: doc } = await admin.from('documento').select('*').eq('id', docId).single()
  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  // Extraer TEXTO COMPLETO del documento (sin truncar la sección)
  let textoCompleto = ''
  try {
    const { data: fileData } = await admin.storage.from('documentos').download(doc.url_storage as string)
    if (fileData) {
      const buffer = Buffer.from(await fileData.arrayBuffer())
      const nombre = (doc.nombre_archivo as string).toLowerCase()
      if (nombre.endsWith('.docx') || nombre.endsWith('.doc')) textoCompleto = await extraerTextoDOCX(buffer)
      else if (nombre.endsWith('.pdf')) textoCompleto = await extraerTextoPDF(buffer)
    }
  } catch (err) {
    console.error('[importar] Error extrayendo texto:', err)
  }

  // Fallback: usar analisis_ia
  const ia = ((doc.analisis_ia as Record<string, unknown>)?.analisis ?? doc.analisis_ia) as Record<string, unknown> | null
  const textoFallback = ia ? [
    ia['resumen_ejecutivo'] ? `Resumen: ${ia['resumen_ejecutivo']}` : '',
    ia['diagnostico_operacional'] ? `Estado operacional: ${ia['diagnostico_operacional']}` : '',
    ia['hallazgos_criticos'] ? `Hallazgos: ${JSON.stringify(ia['hallazgos_criticos'])}` : '',
    ia['roles_y_responsabilidades'] ? `Roles: ${JSON.stringify(ia['roles_y_responsabilidades'])}` : '',
    ia['procesos_identificados'] ? `Procesos: ${JSON.stringify(ia['procesos_identificados'])}` : '',
    ia['oportunidades_valor'] ? `Oportunidades: ${JSON.stringify(ia['oportunidades_valor'])}` : '',
    ia['quick_wins'] ? `Quick wins: ${JSON.stringify(ia['quick_wins'])}` : '',
  ].filter(Boolean).join('\n') : ''

  const textoBase = textoCompleto || textoFallback
  if (!textoBase) return NextResponse.json({ error: 'No se pudo obtener contenido del documento' }, { status: 400 })

  const empresa = String(cliente?.razon_social ?? 'N/A')
  const industria = String(cliente?.industria ?? 'N/A')
  const procesoNombre = proceso.nombre as string
  const procesoDesc = (proceso.descripcion as string) ?? ''

  // Contexto base reutilizable (sin el texto completo para no repetirlo)
  const ctx = `EMPRESA: ${empresa} | INDUSTRIA: ${industria}
PROCESO: ${procesoNombre}${procesoDesc ? ` — ${procesoDesc}` : ''}
DOCUMENTO FUENTE: ${doc.nombre_archivo as string}`

  // Texto acotado para prompts individuales (primeros 18000 chars)
  const texto = textoBase.slice(0, 18000)

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
  const modelos = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']

  // Prompts detallados y específicos por tipo
  function buildPrompt(tipo: TipoArtefacto): string {
    const base = `${ctx}\n\nCONTENIDO DEL DOCUMENTO:\n${texto}\n\n`

    switch (tipo) {
      case 'sipoc':
        return base + `Extrae el SIPOC completo del proceso "${procesoNombre}".
Devuelve JSON con esta estructura exacta:
{"proveedores":["lista de proveedores reales del proceso"],"entradas":["lista de entradas/inputs reales"],"proceso":"descripción del proceso central en 1-2 oraciones","salidas":["lista de salidas/outputs reales"],"clientes":["lista de clientes/receptores reales"],"notas":"contexto adicional importante","limite_entrada":"descripción de qué dispara el proceso","limite_salida":"descripción de cuándo termina el proceso"}`

      case 'as_is':
        return base + `Extrae el estado actual AS-IS del proceso "${procesoNombre}".
Devuelve JSON:
{"descripcion_estado_actual":"descripción completa del estado actual","actores":["lista de actores/roles involucrados"],"sistemas_involucrados":["sistemas tecnológicos usados"],"pasos":[{"orden":1,"descripcion":"descripción del paso","responsable":"rol responsable","duracion_estimada":"tiempo estimado","sistema":"sistema usado si aplica"}],"puntos_dolor":["problemas y fricciones identificados"],"tiempo_ciclo_actual":"tiempo total del proceso","volumen_transacciones":"estimado de transacciones por período"}`

      case 'bpmn':
        return base + `Extrae el flujo BPMN del proceso "${procesoNombre}" con TODOS sus pasos reales.
Genera un diagrama React Flow completo. Reglas:
- Nodo inicial tipo "start" (id="1", y=50), nodo final tipo "end"
- Nodos de tareas tipo "task", decisiones tipo "decision"
- Posicionar verticalmente: y aumenta 130px por nivel, x=400 flujo principal, x=680 ramales derecha, x=120 ramales izquierda
- Mínimo 7 nodos, máximo 14 nodos
- Labels descriptivos pero cortos (máx 40 chars)
Devuelve JSON:
{"titulo":"${procesoNombre}","nodes":[{"id":"1","type":"start","position":{"x":400,"y":50},"data":{"label":"Inicio"}},{"id":"2","type":"task","position":{"x":400,"y":180},"data":{"label":"Paso real del proceso"}},...],"edges":[{"id":"e1-2","source":"1","target":"2","animated":true},...]}`

      case 'flujograma':
        return base + `Extrae el flujograma detallado del proceso "${procesoNombre}".
Similar al BPMN pero enfocado en el flujo operativo con todas las decisiones y ramificaciones.
Devuelve JSON:
{"titulo":"${procesoNombre}","nodes":[{"id":"1","type":"start","position":{"x":400,"y":50},"data":{"label":"Inicio"}},...],"edges":[{"id":"e1-2","source":"1","target":"2","animated":true},...]}`

      case 'historias_usuario':
        return base + `Extrae o construye las historias de usuario del proceso "${procesoNombre}".
Devuelve JSON:
{"historias":[{"id":"HU-01","rol":"rol del usuario","necesidad":"qué necesita hacer","beneficio":"para qué / cuál es el valor","prioridad":"alta|media|baja","criterios_aceptacion":["criterio 1","criterio 2"],"puntos_historia":3,"estado":"pendiente"}]}`

      case 'raci':
        return base + `Extrae la matriz RACI del proceso "${procesoNombre}".
Devuelve JSON:
{"actividades":["lista de actividades del proceso"],"roles":["lista de roles/actores"],"matriz":{"Actividad 1":{"Rol A":"R","Rol B":"A","Rol C":"C"},...},"leyenda":{"R":"Responsable de ejecutar","A":"Aprobador","C":"Consultado","I":"Informado"}}`

      case 'riesgo_control':
        return base + `Extrae los riesgos y controles del proceso "${procesoNombre}".
Devuelve JSON:
{"riesgos":[{"id":"R-01","descripcion":"descripción del riesgo","categoria":"operacional|financiero|regulatorio|tecnológico","probabilidad":"alta|media|baja","impacto":"alto|medio|bajo","nivel_riesgo":"alto|medio|bajo","control":"control mitigante","tipo_control":"preventivo|detectivo|correctivo","responsable":"rol responsable","estado":"activo|mitigado"}]}`

      case 'kpi_sla':
        return base + `Extrae los KPIs y SLAs del proceso "${procesoNombre}".
Devuelve JSON:
{"indicadores":[{"nombre":"nombre del KPI","descripcion":"qué mide","formula":"cómo se calcula","unidad":"%|días|N°|$","linea_base":"valor actual","meta":"valor objetivo","frecuencia":"diaria|semanal|mensual","dueno":"rol responsable","fuente_dato":"sistema fuente","sla":"acuerdo de nivel de servicio si aplica","tipo":"eficiencia|calidad|tiempo|costo"}],"financiero":{"ahorro_estimado":"","roi_estimado":""}}`

      case 'diagnostico':
        return base + `Realiza el diagnóstico FODA y nivel de madurez del proceso "${procesoNombre}".
Devuelve JSON:
{"nivel_madurez":2,"nivel_madurez_descripcion":"descripción del nivel (1=inicial, 2=repetible, 3=definido, 4=gestionado, 5=optimizado)","fortalezas":["fortaleza 1"],"debilidades":["debilidad 1"],"oportunidades":["oportunidad 1"],"amenazas":["amenaza 1"],"brechas_criticas":["brecha prioritaria 1"],"recomendaciones_prioritarias":["recomendación 1"],"conclusion":"resumen ejecutivo del diagnóstico"}`

      case 'to_be':
        return base + `Extrae o construye el estado futuro TO-BE del proceso "${procesoNombre}".
Devuelve JSON:
{"descripcion_estado_futuro":"descripción completa del estado futuro deseado","actores":["actores en el nuevo modelo"],"sistemas_requeridos":["sistemas necesarios"],"pasos":[{"orden":1,"descripcion":"paso mejorado","responsable":"rol","automatizado":false,"herramienta":"","mejora_vs_asis":"qué mejora respecto al AS-IS"}],"metricas_objetivo":[{"nombre":"KPI","valor_actual":"","valor_objetivo":"","plazo":""}],"mejoras_respecto_asis":["mejora concreta 1"],"tiempo_ciclo_objetivo":"","reduccion_estimada":""}`

      case 'dashboard_brechas':
        return base + `Construye el dashboard de brechas AS-IS vs TO-BE del proceso "${procesoNombre}".
Devuelve JSON:
{"resumen_ejecutivo":"análisis ejecutivo de brechas","comparativo":[{"dimension":"dimensión evaluada","valor_asis":"situación actual","valor_tobe":"situación futura","brecha":"descripción de la brecha","impacto":"alto|medio|bajo","iniciativa":"iniciativa para cerrar la brecha","esfuerzo":"alto|medio|bajo"}],"quick_wins":["acción de impacto rápido 1"],"indice_brecha_global":65,"conclusion":"conclusión y priorización"}`

      case 'cierre_ejecutivo':
        return base + `Extrae el resumen ejecutivo de cierre del proceso "${procesoNombre}".
Devuelve JSON:
{"titulo_proyecto":"título del proyecto","resumen_proyecto":"resumen ejecutivo completo","procesos_transformados":1,"reduccion_tiempo_ciclo_estimada":"X%","ahorro_estimado":"$X","roi_estimado":"X%","logros_principales":["logro 1"],"proximos_pasos":["paso 1"],"recomendacion_ceo":"recomendación estratégica para la dirección","fecha_cierre":"","clasificacion_exito":"exitoso|parcial|en_progreso"}`

      case 'checklist':
        return base + `Extrae los checklists operacionales por rol del proceso "${procesoNombre}".
Devuelve JSON:
{"frecuencia_uso":"por_transaccion|diario|semanal","checklists":[{"rol":"nombre del rol","descripcion_rol":"qué hace este rol en el proceso","items":[{"descripcion":"tarea específica a verificar","fase":"preparacion|ejecucion|cierre|revision","critico":true,"nota":"observación si aplica"}]}]}`

      case 'backlog':
        return base + `Extrae el backlog priorizado de mejoras e iniciativas del proceso "${procesoNombre}".
Devuelve JSON:
{"resumen":{"total_quick_wins":0,"total_proyectos_medios":0,"total_proyectos_mayores":0,"esfuerzo_total_semanas":0},"iniciativas":[{"id":"I-01","titulo":"nombre de la iniciativa","descripcion":"descripción detallada","categoria":"quick_win|proyecto_medio|proyecto_mayor","impacto":4,"esfuerzo":2,"tiempo_estimado":"2 semanas","responsable_sugerido":"rol","beneficio_esperado":"descripción del beneficio","dependencias":[]}]}`

      case 'cinco_porques':
        return base + `Aplica el análisis de 5 Porqués a los problemas principales del proceso "${procesoNombre}".
Devuelve JSON:
{"analisis":[{"problema":"descripción del problema principal","impacto":"impacto en el proceso/negocio","cadena":[{"porque":"1er porqué"},{"porque":"2do porqué"},{"porque":"3er porqué"},{"porque":"4to porqué"},{"porque":"5to porqué — causa raíz"}],"causa_raiz":"causa raíz identificada","tipo_causa":"proceso|persona|tecnología|datos|proveedor","accion_correctiva":"acción para eliminar la causa raíz","responsable":"rol responsable","plazo":"estimado de implementación"}],"conclusion_sistemica":"patrones sistémicos identificados"}`

      case 'acta_inicio':
        return base + `Extrae el Acta de Inicio del proyecto/proceso "${procesoNombre}".
Devuelve JSON:
{"titulo_proyecto":"título formal","proposito":"propósito y justificación del proyecto","fecha_inicio":"","fecha_fin_estimada":"","presupuesto_estimado":"","patrocinador":"nombre o rol del sponsor","director_proyecto":"","alcance":{"incluye":["entregable 1"],"excluye":["exclusión 1"]},"objetivos":[{"descripcion":"objetivo","metrica":"cómo se mide","meta":"valor objetivo"}],"supuestos":["supuesto 1"],"restricciones":["restricción 1"],"criterios_exito":["criterio 1"],"firmas_requeridas":["rol 1"]}`

      case 'plan_pruebas':
        return base + `Construye el plan de pruebas del proceso "${procesoNombre}".
Devuelve JSON:
{"resumen":"descripción del plan de pruebas","ambiente_pruebas":"descripción del ambiente","responsable_pruebas":"rol responsable","casos":[{"id":"CP-01","nombre":"nombre del caso","tipo":"funcional|integración|regresión|usuario","prioridad":"alta|media|baja","precondicion":"condición previa","pasos":["paso 1","paso 2"],"resultado_esperado":"qué debe ocurrir","criterio_falla":"cuándo falla"}],"criterios_aprobacion":["criterio global 1"],"plan_contingencia":"qué hacer si las pruebas fallan"}`

      case 'roadmap':
        return base + `Extrae el roadmap de implementación del proceso "${procesoNombre}".
Devuelve JSON:
{"duracion_total_semanas":12,"metodologia":"metodología de implementación","fases":[{"nombre":"nombre de la fase","objetivo":"objetivo de esta fase","semana_inicio":1,"semana_fin":4,"duracion_semanas":4,"actividades":["actividad 1"],"entregables":["entregable 1"],"hitos":["hito clave"]}],"factores_exito":["factor crítico 1"],"riesgos_implementacion":["riesgo 1"]}`

      default:
        return base + `Extrae información sobre "${tipo}" del proceso "${procesoNombre}". Devuelve un JSON estructurado con la información relevante encontrada en el documento.`
    }
  }

  // Extraer un artefacto con reintentos
  async function extraerArtefacto(tipo: TipoArtefacto): Promise<{ tipo: TipoArtefacto; contenido: unknown; ok: boolean }> {
    const prompt = buildPrompt(tipo)
    const contenido = await llamarGroq(groq, modelos, prompt, 3500)
    if (contenido) return { tipo, contenido, ok: true }
    return { tipo, contenido: null, ok: false }
  }

  // Ejecutar en lotes de 4 para no saturar el rate limit de Groq
  const resultadosArr = await enLotes(
    ORDEN_GENERACION,
    4,
    (tipo) => extraerArtefacto(tipo as TipoArtefacto),
    1000
  ) as Array<{ tipo: TipoArtefacto; contenido: unknown; ok: boolean }>

  const errores: string[] = []
  let guardados = 0

  for (const r of resultadosArr) {
    if (!r.ok || r.contenido === null) { errores.push(r.tipo); continue }

    const { data: existing } = await admin
      .from('artefacto')
      .select('id, version')
      .eq('proceso_id', params.id)
      .eq('tipo', r.tipo)
      .single()

    if (existing) {
      await admin.from('artefacto').update({
        contenido: r.contenido,
        version: (existing.version ?? 1) + 1,
        estado_validacion: 'pendiente',
        generado_por_ia: true,
      }).eq('id', existing.id)
    } else {
      await admin.from('artefacto').insert({
        proceso_id: params.id,
        proyecto_id: proceso.proyecto_id,
        tipo: r.tipo,
        contenido: r.contenido,
        estado_validacion: 'pendiente',
        generado_por_ia: true,
      })
    }
    guardados++
  }

  return NextResponse.json({
    ok: true,
    guardados,
    total: ORDEN_GENERACION.length,
    errores,
    fuente: textoCompleto ? 'documento' : 'analisis_ia',
    documento: doc.nombre_archivo,
  })
}

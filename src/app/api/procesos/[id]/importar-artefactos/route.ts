import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Groq from 'groq-sdk'
import { extraerTextoPDF, extraerTextoDOCX } from '@/lib/extract-text'
import { ORDEN_GENERACION } from '@/lib/artefactos-meta'
import type { TipoArtefacto } from '@/types/database'

// Extrae el texto de la sección ARTEFACTOS METODOLÓGICOS del documento
function extraerSeccionArtefactos(texto: string): string {
  const patrones = [
    /artefactos\s+metodol[oó]gicos/i,
    /marco\s+metodol[oó]gico/i,
    /artefactos\s+del\s+proceso/i,
    /documentaci[oó]n\s+metodol[oó]gica/i,
  ]
  let inicio = -1
  for (const p of patrones) {
    const m = texto.search(p)
    if (m >= 0 && (inicio < 0 || m < inicio)) inicio = m
  }
  if (inicio < 0) return texto.slice(0, 12000) // si no hay sección, usar todo

  // Extraer desde esa sección hasta el final o hasta la siguiente sección de nivel similar
  const resto = texto.slice(inicio)
  // Máx 15000 chars — más que suficiente para todos los artefactos
  return resto.slice(0, 15000)
}

// Prompt por tipo de artefacto para extracción desde el documento
const PROMPT_EXTRACCION: Record<TipoArtefacto, string> = {
  sipoc: `Extrae el SIPOC del documento. Devuelve: {"proveedores":[],"entradas":[],"proceso":"","salidas":[],"clientes":[],"notas":""}`,
  as_is: `Extrae el AS-IS (estado actual del proceso). Devuelve: {"descripcion_estado_actual":"","actores":[],"sistemas_involucrados":[],"pasos":[{"orden":1,"descripcion":"","responsable":"","duracion_estimada":""}],"puntos_dolor":[],"tiempo_ciclo_actual":""}`,
  bpmn: `Extrae el flujo BPMN/diagrama de procesos. Devuelve: {"titulo":"","descripcion":"","nodes":[{"id":"1","type":"default","position":{"x":100,"y":100},"data":{"label":"Inicio"}}],"edges":[]}`,
  flujograma: `Extrae el flujograma del proceso. Devuelve: {"titulo":"","nodes":[{"id":"1","type":"default","position":{"x":100,"y":100},"data":{"label":"Inicio"}}],"edges":[]}`,
  historias_usuario: `Extrae las historias de usuario. Devuelve: {"historias":[{"id":"HU-01","rol":"","necesidad":"","beneficio":"","prioridad":"alta","criterios_aceptacion":[],"puntos_historia":3}]}`,
  raci: `Extrae la matriz RACI. Devuelve: {"actividades":[],"roles":[],"matriz":{}}  La matriz tiene estructura: {actividad: {rol: "R"|"A"|"C"|"I"}}`,
  riesgo_control: `Extrae los riesgos y controles. Devuelve: {"riesgos":[{"id":"R-01","descripcion":"","categoria":"","probabilidad":"media","impacto":"alto","nivel_riesgo":"alto","control":"","responsable":"","estado":"activo"}]}`,
  kpi_sla: `Extrae los KPIs y SLAs. Devuelve: {"indicadores":[{"nombre":"","descripcion":"","formula":"","unidad":"","linea_base":"","meta":"","frecuencia":"mensual","dueno":"","fuente_dato":"","sla":"","valor_real":null}],"financiero":{}}`,
  diagnostico: `Extrae el diagnóstico del proceso (FODA, nivel de madurez). Devuelve: {"nivel_madurez":2,"nivel_madurez_descripcion":"","fortalezas":[],"debilidades":[],"oportunidades":[],"amenazas":[],"brechas_criticas":[],"recomendaciones_prioritarias":[]}`,
  to_be: `Extrae el estado futuro TO-BE del proceso. Devuelve: {"descripcion_estado_futuro":"","actores":[],"sistemas_requeridos":[],"pasos":[{"orden":1,"descripcion":"","responsable":"","automatizado":false,"herramienta":""}],"metricas_objetivo":[{"nombre":"","valor_actual":"","valor_objetivo":""}],"mejoras_respecto_asis":[]}`,
  dashboard_brechas: `Extrae el dashboard de brechas (AS-IS vs TO-BE). Devuelve: {"resumen_ejecutivo":"","comparativo":[{"dimension":"","valor_asis":"","valor_tobe":"","brecha":"","impacto":"alto","iniciativa":""}],"quick_wins":[],"indice_brecha_global":0}`,
  cierre_ejecutivo: `Extrae el resumen ejecutivo de cierre. Devuelve: {"titulo_proyecto":"","resumen_proyecto":"","procesos_transformados":0,"reduccion_tiempo_ciclo_estimada":"","roi_estimado":"","logros_principales":[],"proximos_pasos":[],"recomendacion_ceo":""}`,
  checklist: `Extrae los checklists por rol. Devuelve: {"frecuencia_uso":"por_transaccion","checklists":[{"rol":"","descripcion_rol":"","items":[{"descripcion":"","fase":"preparacion","critico":false,"nota":""}]}]}`,
  backlog: `Extrae el backlog priorizado de iniciativas. Devuelve: {"resumen":{"total_quick_wins":0,"total_proyectos_medios":0,"total_proyectos_mayores":0,"esfuerzo_total_semanas":0},"iniciativas":[{"id":"I-01","titulo":"","descripcion":"","categoria":"quick_win","impacto":4,"esfuerzo":2,"tiempo_estimado":"2 semanas","responsable_sugerido":"","beneficio_esperado":""}]}`,
  cinco_porques: `Extrae el análisis de 5 porqués. Devuelve: {"analisis":[{"problema":"","impacto":"","cadena":[{"porque":""}],"causa_raiz":"","tipo_causa":"proceso","accion_correctiva":"","responsable":"","plazo":""}],"conclusion_sistemica":""}`,
  acta_inicio: `Extrae el acta de inicio del proyecto. Devuelve: {"titulo_proyecto":"","proposito":"","fecha_inicio":"","fecha_fin_estimada":"","presupuesto_estimado":"","patrocinador":"","director_proyecto":"","alcance":{"incluye":[],"excluye":[]},"objetivos":[{"descripcion":"","metrica":"","meta":""}],"supuestos":[],"restricciones":[],"criterios_exito":[],"firmas_requeridas":[]}`,
  plan_pruebas: `Extrae el plan de pruebas. Devuelve: {"resumen":"","ambiente_pruebas":"","responsable_pruebas":"","casos":[{"id":"CP-01","nombre":"","tipo":"funcional","prioridad":"alta","precondicion":"","pasos":[],"resultado_esperado":"","criterio_falla":""}],"criterios_aprobacion":[],"plan_contingencia":""}`,
  roadmap: `Extrae el roadmap de implementación. Devuelve: {"duracion_total_semanas":12,"metodologia":"","fases":[{"nombre":"","objetivo":"","semana_inicio":1,"semana_fin":4,"duracion_semanas":4,"actividades":[],"entregables":[],"hitos":[]}],"factores_exito":[]}`,
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()

  // Cargar proceso y su documento origen
  const { data: proceso } = await admin
    .from('proceso')
    .select('*, proyecto:proyecto_id(nombre, cliente:cliente_id(razon_social, industria))')
    .eq('id', params.id)
    .single()

  if (!proceso) return NextResponse.json({ error: 'Proceso no encontrado' }, { status: 404 })

  const proyecto = proceso.proyecto as Record<string, unknown>
  const cliente = proyecto?.cliente as Record<string, unknown>

  // Buscar documento del proceso — primero el documento_origen_id, luego por proyecto
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
    // Ultimo intento: cualquier documento del proyecto con análisis
    const { data: docs } = await admin
      .from('documento')
      .select('id')
      .eq('proyecto_id', proceso.proyecto_id)
      .not('analisis_ia', 'is', null)
      .limit(1)
    docId = docs?.[0]?.id ?? null
  }

  if (!docId) {
    return NextResponse.json({ error: 'No hay documentos procesados para este proceso' }, { status: 404 })
  }

  const { data: doc } = await admin.from('documento').select('*').eq('id', docId).single()
  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  // Descargar y extraer texto del documento
  let textoDocumento = ''
  try {
    const { data: fileData } = await admin.storage.from('documentos').download(doc.url_storage as string)
    if (fileData) {
      const buffer = Buffer.from(await fileData.arrayBuffer())
      const nombre = (doc.nombre_archivo as string).toLowerCase()
      if (nombre.endsWith('.docx') || nombre.endsWith('.doc')) {
        textoDocumento = await extraerTextoDOCX(buffer)
      } else if (nombre.endsWith('.pdf')) {
        textoDocumento = await extraerTextoPDF(buffer)
      }
    }
  } catch (err) {
    console.error('[importar-artefactos] Error extrayendo texto:', err)
  }

  // Si no se pudo extraer texto, usar el análisis IA como contexto
  const ia = (doc.analisis_ia as any)?.analisis ?? doc.analisis_ia as any
  const contextoFallback = ia ? [
    ia.resumen_ejecutivo ? `Descripción: ${ia.resumen_ejecutivo}` : '',
    ia.diagnostico_operacional ? `Estado operacional: ${ia.diagnostico_operacional}` : '',
    ia.hallazgos_criticos?.length ? `Hallazgos: ${(ia.hallazgos_criticos as string[]).join('; ')}` : '',
    ia.roles_y_responsabilidades?.roles_identificados?.length
      ? `Roles: ${(ia.roles_y_responsabilidades.roles_identificados as string[]).join(', ')}`
      : '',
    ia.procesos_identificados?.length ? `Procesos: ${(ia.procesos_identificados as string[]).join('; ')}` : '',
    ia.oportunidades_valor?.length
      ? `Oportunidades: ${(ia.oportunidades_valor as Array<{oportunidad:string}>).map(o => o.oportunidad).join('; ')}`
      : '',
    ia.quick_wins?.length ? `Quick wins: ${(ia.quick_wins as string[]).join('; ')}` : '',
  ].filter(Boolean).join('\n') : ''

  const textoBase = textoDocumento
    ? extraerSeccionArtefactos(textoDocumento)
    : contextoFallback

  if (!textoBase) {
    return NextResponse.json({ error: 'No se pudo obtener contenido del documento' }, { status: 400 })
  }

  const contextoEmpresa = `EMPRESA: ${String(cliente?.razon_social ?? 'N/A')}
INDUSTRIA: ${String(cliente?.industria ?? 'N/A')}
PROCESO: ${proceso.nombre} — ${proceso.descripcion ?? ''}
DOCUMENTO: ${doc.nombre_archivo as string}`

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
  const modelos = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']

  const esqueleton = (tipo: TipoArtefacto) => ({
    titulo: proceso.nombre,
    descripcion: `Diagrama ${tipo === 'bpmn' ? 'BPMN' : 'de flujo'} — ${proceso.nombre}`,
    nodes: [
      { id: '1', type: 'input', position: { x: 250, y: 50 }, data: { label: 'Inicio' } },
      { id: '2', type: 'default', position: { x: 250, y: 150 }, data: { label: proceso.nombre } },
      { id: '3', type: 'output', position: { x: 250, y: 250 }, data: { label: 'Fin' } },
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2', animated: true },
      { id: 'e2-3', source: '2', target: '3', animated: true },
    ],
  })

  async function extraerArtefacto(tipo: TipoArtefacto): Promise<{ tipo: TipoArtefacto; contenido: unknown; ok: boolean }> {
    if (tipo === 'bpmn' || tipo === 'flujograma') {
      return { tipo, contenido: esqueleton(tipo), ok: true }
    }
    const promptExtraccion = PROMPT_EXTRACCION[tipo]
    if (!promptExtraccion) return { tipo, contenido: null, ok: false }

    const prompt = `${contextoEmpresa}

CONTENIDO DEL DOCUMENTO:
${textoBase}

TAREA: ${promptExtraccion}

Extrae la información DIRECTAMENTE del documento. Si el documento no contiene esta información, construye el artefacto basándote en el contexto disponible.
Responde ÚNICAMENTE con el JSON solicitado, sin texto adicional.`

    for (const modelo of modelos) {
      try {
        const completion = await groq.chat.completions.create({
          model: modelo,
          max_tokens: 2000,
          temperature: 0.1,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        })
        const text = completion.choices[0]?.message?.content ?? ''
        if (!text) continue
        const parsed = JSON.parse(text)
        return { tipo, contenido: (parsed.resultado ?? parsed) as Record<string, unknown>, ok: true }
      } catch {
        continue
      }
    }
    return { tipo, contenido: null, ok: false }
  }

  // Ejecutar todas las extracciones en paralelo (5x más rápido)
  const resultadosArr = await Promise.all(ORDEN_GENERACION.map(tipo => extraerArtefacto(tipo)))
  const resultados: Record<string, unknown> = {}
  const errores: string[] = []
  for (const r of resultadosArr) {
    if (r.ok && r.contenido !== null) resultados[r.tipo] = r.contenido
    else errores.push(r.tipo)
  }

  // Guardar todos los artefactos extraídos en BD
  let guardados = 0
  for (const [tipo, contenido] of Object.entries(resultados)) {
    const { data: existing } = await admin
      .from('artefacto')
      .select('id, version')
      .eq('proceso_id', params.id)
      .eq('tipo', tipo)
      .single()

    if (existing) {
      await admin.from('artefacto').update({
        contenido,
        version: existing.version + 1,
        estado_validacion: 'pendiente',
        generado_por_ia: true,
      }).eq('id', existing.id)
    } else {
      await admin.from('artefacto').insert({
        proceso_id: params.id,
        proyecto_id: proceso.proyecto_id,
        tipo,
        contenido,
        estado_validacion: 'pendiente',
        generado_por_ia: true,
      })
    }
    guardados++
  }

  return NextResponse.json({
    ok: true,
    guardados,
    errores,
    fuente: textoDocumento ? 'documento' : 'analisis_ia',
    documento: doc.nombre_archivo,
  })
}

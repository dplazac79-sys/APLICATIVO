import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const promptCache = new Map<string, string>()

function loadPrompt(name: string): string {
  if (promptCache.has(name)) return promptCache.get(name)!
  const filePath = path.join(process.cwd(), 'src/lib/prompts', `${name}.md`)
  const content = fs.readFileSync(filePath, 'utf-8')
  promptCache.set(name, content)
  return content
}

export function extractJson(text: string): unknown {
  let raw = text.trim()
  const mdMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (mdMatch) {
    raw = mdMatch[1].trim()
  } else {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) raw = jsonMatch[0]
  }
  return JSON.parse(raw)
}

export async function clasificarDocumento(texto: string) {
  const system = loadPrompt('clasificacion-documental')
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content: `Clasifica este documento:\n\n${texto.slice(0, 8000)}` }],
  })
  return extractJson((msg.content[0] as { text: string }).text) as {
    bloque: string
    confianza: number
    bloques_secundarios: string[]
    industria_detectada: string
    tipo_documento: string
    audiencia_objetivo: string
    proposito_real: string
    palabras_clave: string[]
    senales_madurez: string
    razonamiento: string
  }
}

export async function resumirDocumento(texto: string) {
  const system = loadPrompt('resumen-documento')
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system,
    messages: [{ role: 'user', content: `Resume este documento:\n\n${texto.slice(0, 12000)}` }],
  })
  if (msg.stop_reason === 'max_tokens') {
    throw new Error('La respuesta de la IA se cortó antes de completarse al resumir el documento.')
  }
  return extractJson((msg.content[0] as { text: string }).text) as {
    resumen_ejecutivo: string
    diagnostico_operacional: string
    hallazgos_criticos: string[]
    procesos_identificados: string[]
    roles_y_responsabilidades: {
      roles_identificados: string[]
      brechas_de_rol: string[]
    }
    riesgos_criticos: Array<{ riesgo: string; impacto: string; evidencia: string }>
    oportunidades_valor: Array<{ oportunidad: string; impacto_estimado: string; complejidad_implementacion: string }>
    brechas_documentacion: string[]
    nivel_madurez_amo: number
    nivel_madurez_nombre: string
    nivel_madurez_evidencia: string
    quick_wins: string[]
    recomendacion_ejecutiva: string
    proximos_pasos_sugeridos: string[]
  }
}

export async function reAnalizarContenidoEditado(contenidoEditado: {
  descripcion: string
  sin_proceso_riesgos: string
  con_proceso_beneficios: string
  nombre_proceso: string
}) {
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `Eres un experto en análisis de procesos de negocio. Recibirás contenido editado por el cliente sobre un proceso. Tu tarea es actualizar los KPIs y riesgos en base al nuevo contenido.

Devuelve SOLO un objeto JSON válido:
{
  "valor_negocio": "resumen del valor actualizado según el contenido editado",
  "kpis": [
    {"nombre": "nombre del KPI", "valor_actual": "estimado actual", "valor_objetivo": "objetivo", "unidad": "%, días, $, etc"}
  ],
  "riesgos": [
    {"descripcion": "descripción del riesgo", "probabilidad": "alta|media|baja", "impacto": "alto|medio|bajo"}
  ]
}`,
    messages: [{
      role: 'user',
      content: `Proceso: ${contenidoEditado.nombre_proceso}\n\nDescripción actualizada:\n${contenidoEditado.descripcion}\n\nSin este proceso:\n${contenidoEditado.sin_proceso_riesgos}\n\nCon este proceso:\n${contenidoEditado.con_proceso_beneficios}`
    }],
  })
  if (msg.stop_reason === 'max_tokens') throw new Error('Respuesta IA incompleta al re-analizar')
  return extractJson((msg.content[0] as { text: string }).text) as {
    valor_negocio: string
    kpis: Array<{ nombre: string; valor_actual: string; valor_objetivo: string; unidad: string }>
    riesgos: Array<{ descripcion: string; probabilidad: string; impacto: string }>
  }
}

export async function enriquecerProcesoCliente(
  textoDocumento: string,
  contextoProyecto: string
) {
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `Eres un experto en análisis de procesos de negocio. Recibirás un documento de proceso enviado por un cliente y el contexto del proyecto de consultoría. Tu tarea es enriquecer ese documento para que el cliente entienda:
1. Qué es exactamente este proceso y dónde se ubica en su cadena de valor
2. Qué riesgos existen si este proceso no existe o falla
3. Qué beneficios obtiene si el proceso existe y funciona bien
4. El valor real del proceso para el negocio

Devuelve SOLO un objeto JSON válido con esta estructura exacta:
{
  "nombre_proceso": "nombre claro del proceso",
  "macroproceso": "nombre del macroproceso al que pertenece",
  "numero_en_macroproceso": 2,
  "total_en_macroproceso": 7,
  "descripcion": "descripción clara del proceso en lenguaje de negocio (2-3 párrafos)",
  "sin_proceso_riesgos": "texto explicando qué riesgos y consecuencias reales ocurren si este proceso no existe o falla (lenguaje ejecutivo, no técnico)",
  "con_proceso_beneficios": "texto explicando qué beneficios concretos obtiene la organización con este proceso funcionando bien",
  "valor_negocio": "valor cuantificable: ahorro estimado, reducción de errores, tiempo ahorrado, etc.",
  "actores": ["lista de roles o personas involucradas"],
  "sistemas": ["lista de sistemas de información involucrados"],
  "kpis": [
    {"nombre": "nombre del KPI", "valor_actual": "estimado actual", "valor_objetivo": "objetivo", "unidad": "%, días, $, etc"}
  ],
  "riesgos": [
    {"descripcion": "descripción del riesgo", "probabilidad": "alta|media|baja", "impacto": "alto|medio|bajo"}
  ]
}`,
    messages: [{
      role: 'user',
      content: `Documento del cliente:\n${textoDocumento.slice(0, 10000)}\n\nContexto del proyecto:\n${contextoProyecto.slice(0, 4000)}`
    }],
  })
  if (msg.stop_reason === 'max_tokens') throw new Error('Respuesta IA incompleta al enriquecer proceso')
  return extractJson((msg.content[0] as { text: string }).text) as {
    nombre_proceso: string
    macroproceso: string
    numero_en_macroproceso: number
    total_en_macroproceso: number
    descripcion: string
    sin_proceso_riesgos: string
    con_proceso_beneficios: string
    valor_negocio: string
    actores: string[]
    sistemas: string[]
    kpis: Array<{ nombre: string; valor_actual: string; valor_objetivo: string; unidad: string }>
    riesgos: Array<{ descripcion: string; probabilidad: string; impacto: string }>
  }
}

export async function discoveryProcesos(contextoCliente: string, documentosResumidos: string[]) {
  const system = loadPrompt('discovery-procesos')
  const contenido = `
Contexto del cliente:
${contextoCliente}

Documentos analizados:
${documentosResumidos.map((d, i) => `--- Documento ${i + 1} ---\n${d}`).join('\n\n')}
`
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    system,
    messages: [{ role: 'user', content: contenido }],
  })
  if (msg.stop_reason === 'max_tokens') {
    throw new Error('La respuesta de la IA fue demasiado extensa y se cortó antes de completarse. Intenta con menos documentos a la vez.')
  }
  return extractJson((msg.content[0] as { text: string }).text) as {
    macroprocesos: Array<{
      nombre: string
      descripcion: string
      nivel: number
      tipo: string
      origen: string
      documento_referencia: string | null
      criticidad: string
      estado_actual: string
      procesos: Array<{
        nombre: string
        descripcion: string
        nivel: number
        tipo: string
        origen: string
        documento_referencia: string | null
        justificacion_ia?: string
        evidencia_documento?: string
        criticidad: string
        roles_involucrados: string[]
        riesgos_si_no_existe_o_falla: string[]
        oportunidades_mejora: string[]
        oportunidades_automatizacion: string[]
        kpis_recomendados: string[]
        benchmark_industria: string
      }>
    }>
    resumen_ejecutivo_discovery: string
    industria_detectada: string
    nivel_madurez_operacional: string
    cobertura_documentacion: string
    top_3_brechas_criticas: Array<{ brecha: string; impacto_negocio: string; urgencia: string }>
    top_3_oportunidades_valor: Array<{ oportunidad: string; valor_potencial: string; complejidad: string; tiempo_implementacion: string }>
    quick_wins_90_dias: string[]
    roadmap_transformacion: { fase_1_0_3_meses: string; fase_2_3_6_meses: string; fase_3_6_12_meses: string }
    recomendacion_ceo: string
  }
}

// ── Glosario de Roles ─────────────────────────────────────────────────────────
export interface RolProceso {
  rol: string
  descripcion: string
  procesos: string[]    // nombres de procesos donde aparece
}

export interface PersonaOrg {
  nombre: string
  cargo: string
  skills?: string
}

export interface RolMapeo {
  rol_proceso: string
  descripcion_rol: string
  tipo: 'mapeo_directo' | 'equivalencia' | 'crear_cargo'
  persona_sugerida: string | null
  cargo_sugerido: string | null
  confianza: number           // 0–100
  justificacion: string
  skills_requeridos: string[]
  gap_detectado: string | null
  accion_recomendada: string
}

export async function analizarGlosarioRoles(params: {
  rolesEnProcesos: RolProceso[]
  textoOrganigrama: string
  personas: PersonaOrg[]
  nombreEmpresa: string
  industria: string
  contextoProcesos: string
}) {
  const { rolesEnProcesos, textoOrganigrama, personas, nombreEmpresa, industria, contextoProcesos } = params

  const system = `Eres un experto en gestión organizacional, diseño de cargos y transformación de procesos con más de 20 años de experiencia en industrias de salud, retail, manufactura y servicios. Tu especialidad es mapear roles funcionales de documentos de procesos a estructuras organizacionales reales.

Tu análisis debe ser:
- PRAGMÁTICO: recomienda personas reales, no cargos ideales imposibles
- HONESTO: si hay gaps, dilo claramente con el impacto
- ACCIONABLE: cada recomendación debe poder ejecutarse en < 30 días
- BASADO EN EVIDENCIA: justifica con los datos del organigrama y los CVs

Responde SIEMPRE en JSON válido, sin texto fuera del bloque JSON.`

  const userContent = `
EMPRESA: ${nombreEmpresa}
INDUSTRIA: ${industria}

ROLES MENCIONADOS EN LOS DOCUMENTOS DE PROCESO:
${rolesEnProcesos.map(r => `• ${r.rol}: ${r.descripcion} (aparece en: ${r.procesos.join(', ')})`).join('\n')}

ORGANIGRAMA DEL CLIENTE:
${textoOrganigrama || 'No disponible — analiza solo con los CVs y contexto de industria'}

PERSONAS Y CVS DISPONIBLES:
${personas.length > 0
  ? personas.map(p => `• ${p.nombre} — ${p.cargo}${p.skills ? `: ${p.skills}` : ''}`).join('\n')
  : 'No se subieron CVs — analiza con el organigrama disponible'}

CONTEXTO DE LOS PROCESOS:
${contextoProcesos}

INSTRUCCIONES:
Para cada rol del proceso, determina:
1. Si existe en el organigrama → mapeo_directo (con persona y cargo exacto)
2. Si hay un rol equivalente por skills/responsabilidades → equivalencia (explica por qué)
3. Si no existe nadie que pueda asumirlo → crear_cargo (con descripción del perfil a contratar)

Retorna este JSON exacto:
{
  "mapeos": [
    {
      "rol_proceso": "Jefe de Supply Chain",
      "descripcion_rol": "Qué hace este rol en el proceso",
      "tipo": "mapeo_directo" | "equivalencia" | "crear_cargo",
      "persona_sugerida": "Nombre Apellido" | null,
      "cargo_sugerido": "Cargo real en la empresa" | null,
      "confianza": 85,
      "justificacion": "Razón detallada de la recomendación",
      "skills_requeridos": ["skill1", "skill2"],
      "gap_detectado": "Qué le falta si es equivalencia" | null,
      "accion_recomendada": "Paso concreto a tomar en los próximos 30 días"
    }
  ],
  "resumen_ejecutivo": "Párrafo ejecutivo con el diagnóstico general",
  "alertas_criticas": ["Alerta 1 si hay roles sin cobertura críticos"],
  "plan_accion_30_dias": ["Acción 1", "Acción 2"],
  "score_cobertura_organizacional": 72
}
`

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system,
    messages: [{ role: 'user', content: userContent }],
  })

  return extractJson((msg.content[0] as { text: string }).text) as {
    mapeos: RolMapeo[]
    resumen_ejecutivo: string
    alertas_criticas: string[]
    plan_accion_30_dias: string[]
    score_cobertura_organizacional: number
  }
}

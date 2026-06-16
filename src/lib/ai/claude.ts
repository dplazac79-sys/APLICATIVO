import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function loadPrompt(name: string): string {
  const filePath = path.join(process.cwd(), 'src/lib/prompts', `${name}.md`)
  return fs.readFileSync(filePath, 'utf-8')
}

export function extractJson(text: string): unknown {
  // Remover bloques markdown ```json ... ``` o ``` ... ```
  let raw = text.trim()
  const mdMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (mdMatch) {
    raw = mdMatch[1].trim()
  } else {
    // Extraer el primer objeto JSON válido
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

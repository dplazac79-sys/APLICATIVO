import { createAdminClient } from '@/lib/supabase/admin'

export type TipoUsoIA = 'clasificar' | 'resumir' | 'discovery' | 'embedding' | 'generacion'

// Límites mensuales por proyecto (tier gratuito por defecto)
const LIMITES: Record<string, number> = {
  clasificaciones: 100,
  resumenes: 50,
  discoveries: 10,
  embeddings: 500,
  // Cubre toda la generación estructurada que no tenía categoría propia y por
  // eso nunca pasaba por este límite: proyección TO-BE, recomendaciones de
  // implementación, importación de artefactos, resumen de discovery,
  // mejora de artefactos con IA, simulación de horizonte de impacto,
  // motor de recomendaciones de automatización.
  generaciones: 200,
}

// Costo por tipo (USD) — Together AI cobra un único rate por token para
// Llama-3.3-70B-Instruct-Turbo (no hay tarifa diferenciada input/output como
// en otros proveedores). ~$0.88 por 1M tokens. Groq (fallback) tiene su
// propio pricing pero no lo distinguimos acá: esto es una estimación de
// costo para alertas de uso, no facturación exacta.
const COSTO_POR_1M_TOKENS_USD = 0.88
const costoGenerico = (i: number, o: number) => ((i + o) * COSTO_POR_1M_TOKENS_USD) / 1_000_000

const COSTO_POR_TIPO: Record<TipoUsoIA, (input: number, output: number) => number> = {
  clasificar:  costoGenerico,
  resumir:     costoGenerico,
  discovery:   costoGenerico,
  generacion:  costoGenerico,
  embedding:   ()     => 0.00000015, // Voyage AI por token
}

export async function verificarLimiteIA(
  proyecto_id: string,
  tipo: TipoUsoIA
): Promise<{ permitido: boolean; mensaje?: string }> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('uso_ia_mes_actual')
    .select('*')
    .eq('proyecto_id', proyecto_id)
    .maybeSingle()

  // maybeSingle() distingue "sin filas" (proyecto sin uso este mes — 0 <
  // límite, permitir) de un error real de consulta (antes ambos casos
  // caían en el mismo "if (!data)" y fallaban abierto — un error transitorio
  // de BD deshabilitaba el límite en silencio en vez de bloquear por
  // defecto, hallazgo de auditoría de seguridad).
  if (error) return { permitido: false, mensaje: 'No se pudo verificar el límite de uso de IA. Intenta de nuevo en unos minutos.' }
  if (!data) return { permitido: true }

  const limiteKey = tipo === 'clasificar' ? 'clasificaciones'
    : tipo === 'resumir' ? 'resumenes'
    : tipo === 'discovery' ? 'discoveries'
    : tipo === 'generacion' ? 'generaciones'
    : 'embeddings'

  const uso = Number(data[limiteKey] ?? 0)
  const limite = LIMITES[limiteKey]

  if (uso >= limite) {
    return {
      permitido: false,
      mensaje: `Límite mensual de ${tipo} alcanzado (${uso}/${limite}). Se renueva el 1 del próximo mes.`,
    }
  }

  return { permitido: true }
}

export async function registrarUsoIA(params: {
  proyecto_id: string
  usuario_id: string
  tipo: TipoUsoIA
  tokens_input?: number
  tokens_output?: number
}) {
  const admin = createAdminClient()
  const { proyecto_id, usuario_id, tipo, tokens_input = 0, tokens_output = 0 } = params
  const costo_usd = COSTO_POR_TIPO[tipo]?.(tokens_input, tokens_output) ?? 0

  await admin.from('uso_ia').insert({
    proyecto_id,
    usuario_id,
    tipo,
    tokens_input,
    tokens_output,
    costo_usd,
  })
}

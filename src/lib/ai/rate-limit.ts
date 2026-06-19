import { createAdminClient } from '@/lib/supabase/admin'

// Límites mensuales por proyecto (tier gratuito por defecto)
const LIMITES = {
  clasificaciones: 100,
  resumenes: 50,
  discoveries: 10,
  embeddings: 500,
}

// Costo aproximado por tipo (USD) basado en claude-sonnet-4-6
const COSTO_POR_TIPO: Record<string, (input: number, output: number) => number> = {
  clasificar:  (i, o) => (i * 3 + o * 15) / 1_000_000,
  resumir:     (i, o) => (i * 3 + o * 15) / 1_000_000,
  discovery:   (i, o) => (i * 3 + o * 15) / 1_000_000,
  embedding:   ()     => 0.00000015, // Voyage AI por token
}

export async function verificarLimiteIA(
  proyecto_id: string,
  tipo: 'clasificar' | 'resumir' | 'discovery' | 'embedding'
): Promise<{ permitido: boolean; mensaje?: string }> {
  const admin = createAdminClient()

  const { data } = await admin
    .from('uso_ia_mes_actual')
    .select('*')
    .eq('proyecto_id', proyecto_id)
    .single()

  if (!data) return { permitido: true }

  const limiteKey = tipo === 'clasificar' ? 'clasificaciones'
    : tipo === 'resumir' ? 'resumenes'
    : tipo === 'discovery' ? 'discoveries'
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
  tipo: 'clasificar' | 'resumir' | 'discovery' | 'embedding'
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

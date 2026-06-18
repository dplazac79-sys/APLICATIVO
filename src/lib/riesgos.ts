export type Probabilidad = 'alta' | 'media' | 'baja'
export type Impacto = 'alto' | 'medio' | 'bajo'
export type NivelRiesgo = 'critico' | 'alto' | 'medio' | 'bajo'

export function calcularNivelRiesgo(probabilidad: Probabilidad, impacto: Impacto): NivelRiesgo {
  if (probabilidad === 'alta' && impacto === 'alto') return 'critico'
  if (probabilidad === 'alta' && impacto === 'medio') return 'alto'
  if (probabilidad === 'alta' && impacto === 'bajo') return 'medio'
  if (probabilidad === 'media' && impacto === 'alto') return 'alto'
  if (probabilidad === 'media' && impacto === 'medio') return 'medio'
  if (probabilidad === 'media' && impacto === 'bajo') return 'bajo'
  if (probabilidad === 'baja' && impacto === 'alto') return 'medio'
  if (probabilidad === 'baja' && impacto === 'medio') return 'bajo'
  return 'bajo'
}

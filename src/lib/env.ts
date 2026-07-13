// Validación centralizada de variables de entorno críticas — antes no
// existía ninguna, así que una SUPABASE_SERVICE_ROLE_KEY faltante/mal
// configurada solo se descubría cuando algún código la usaba por primera
// vez en producción (a veces minutos/horas después del deploy, en medio de
// una request real de un usuario), en vez de fallar de inmediato con un
// mensaje claro.
//
// No se valida vía instrumentation.ts (el hook "real" de boot de Next.js)
// a propósito: este proyecto corre en modo `output: 'standalone'` (ver
// next.config.mjs) vía un build custom en railway.toml, y hay precedente
// reciente en este mismo repo de un archivo que Next.js no copia
// correctamente al output standalone sin un paso manual (ver el
// buildCommand de railway.toml, que copia .next/static a mano). No hay
// forma de verificar con confianza, sin acceso al entorno real de Railway,
// que instrumentation.ts se ejecute correctamente en ese modo — así que en
// vez de arriesgar una validación que nunca corre (fallo silencioso, peor
// que no tener nada), se llama explícitamente desde el middleware
// (updateSession), que ya está confirmado corriendo en cada request en
// producción bajo standalone.
const REQUERIDAS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

let validado = false

export function validarEnvCritico(): void {
  if (validado) return // solo valida una vez por proceso, no en cada request
  const faltantes = REQUERIDAS.filter(k => !process.env[k])
  if (faltantes.length > 0) {
    throw new Error(
      `Variables de entorno requeridas ausentes: ${faltantes.join(', ')}. ` +
      `Revisa la configuración de variables en Railway (o .env.local en desarrollo).`
    )
  }
  validado = true
}

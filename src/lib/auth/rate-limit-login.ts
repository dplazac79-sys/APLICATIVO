import { createAdminClient } from '@/lib/supabase/admin'

const VENTANA_MS = 15 * 60 * 1000 // 15 minutos
const MAX_INTENTOS_POR_IP = 20 // ~1.3 intentos/min sostenido — generoso para uso legítimo, corta fuerza bruta
const RETENCION_MS = 7 * 24 * 60 * 60 * 1000 // 7 días
const PROBABILIDAD_LIMPIEZA = 0.02 // ~1 de cada 50 requests dispara la limpieza — evita una query extra en cada login

// Límite de volumen de intentos de login por IP, independiente del lockout
// por cuenta (que ya existe en /api/auth/login). Sin esto, un atacante puede
// probar credenciales contra muchas cuentas distintas desde la misma IP sin
// disparar nunca el lockout de 3 intentos de una sola cuenta.
export async function checkLoginRateLimit(ip: string): Promise<{ permitido: boolean; mensaje?: string }> {
  const admin = createAdminClient()
  const desde = new Date(Date.now() - VENTANA_MS).toISOString()

  const { count } = await admin
    .from('login_intento_ip')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('created_at', desde)

  if ((count ?? 0) >= MAX_INTENTOS_POR_IP) {
    return { permitido: false, mensaje: 'Demasiados intentos de inicio de sesión desde tu red. Intenta de nuevo en unos minutos.' }
  }

  await admin.from('login_intento_ip').insert({ ip })

  // Sin esto la tabla crece sin límite (nunca hay un DELETE) — especialmente
  // grave bajo el escenario que esta misma tabla defiende (fuerza bruta).
  // Limpieza probabilística en vez de una query extra en cada request.
  if (Math.random() < PROBABILIDAD_LIMPIEZA) {
    const limite = new Date(Date.now() - RETENCION_MS).toISOString()
    admin.from('login_intento_ip').delete().lt('created_at', limite).then(
      () => {},
      err => console.error('[rate-limit-login] Falló limpieza de intentos antiguos:', err instanceof Error ? err.message : err)
    )
  }

  return { permitido: true }
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'desconocida'
}

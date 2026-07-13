import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Railway usa esta ruta como gate de deploy (healthcheckTimeout=120s en
// railway.toml) y como criterio de restart automático — antes devolvía
// {status:'ok'} incondicionalmente, sin verificar nada. Un deploy con
// SUPABASE_SERVICE_ROLE_KEY mal configurada o con la BD caída pasaba el
// healthcheck igual (el proceso Node está vivo) y quedaba sirviendo
// tráfico real con cada request a la BD fallando. Ahora hace una query
// mínima real con timeout corto — si Supabase no responde en 4s o falla,
// devuelve 503 en vez de fingir que todo está bien.
const TIMEOUT_MS = 4000

export async function GET() {
  try {
    const admin = createAdminClient()
    const check = admin.from('usuario').select('id', { count: 'exact', head: true }).limit(1)
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout verificando conexión a la base de datos')), TIMEOUT_MS)
    )
    const { error } = await Promise.race([check, timeout])
    if (error) throw error

    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[health] Falló el chequeo de conectividad a la base de datos:', mensaje)
    return NextResponse.json(
      { status: 'error', mensaje, timestamp: new Date().toISOString() },
      { status: 503 }
    )
  }
}

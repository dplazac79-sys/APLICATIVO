import { createClient } from '@supabase/supabase-js'

// Cliente con service role — solo para operaciones server-side que necesitan bypasear RLS
// Usa SUPABASE_URL (privada) con fallback a la pública para evitar exponer la URL
// en el bundle del cliente cuando esta función se importa desde server components.
export function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: (url: RequestInfo | URL, options?: RequestInit) => fetch(url, { ...options, cache: 'no-store' }) },
    }
  )
}

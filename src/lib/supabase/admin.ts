import { createClient } from '@supabase/supabase-js'

// Cliente con service role — solo para operaciones server-side que necesitan bypasear RLS
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

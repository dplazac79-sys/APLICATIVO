import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

// analytics/page.tsx es 'use client' sin ningún chequeo de rol propio —
// solo estaba oculto en el sidebar. Cualquier usuario autenticado podía
// entrar directo por URL y ver el widget de grafo de conocimiento
// (pensado para super_admin). Mismo patrón que automation/layout.tsx.
// Hallazgo de auditoría profunda de frontend.
const ROLES_PERMITIDOS = ['super_admin']

export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: usuario } = await admin.from('usuario').select('rol').eq('id', user.id).single()

  if (!usuario || !ROLES_PERMITIDOS.includes(usuario.rol)) redirect('/dashboard')

  return <>{children}</>
}

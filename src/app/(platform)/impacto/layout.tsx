import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

const ROLES_INTERNOS = ['super_admin', 'director_proyecto', 'consultor']

export default async function ImpactoLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: usuario } = await admin.from('usuario').select('rol').eq('id', user.id).single()

  if (!usuario || !ROLES_INTERNOS.includes(usuario.rol)) redirect('/dashboard')

  return <>{children}</>
}

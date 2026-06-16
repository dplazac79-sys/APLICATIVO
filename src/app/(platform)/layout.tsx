export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AppSidebar from '@/components/layout/AppSidebar'
import AppHeader from '@/components/layout/AppHeader'

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()
  let { data: usuario } = await admin
    .from('usuario')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!usuario) {
    const { data: nuevo } = await admin
      .from('usuario')
      .upsert({
        id: user.id,
        email: user.email ?? '',
        nombre: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Usuario',
        rol: 'super_admin',
      })
      .select()
      .single()
    usuario = nuevo
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <AppSidebar rol={usuario?.rol ?? 'usuario_cliente'} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <AppHeader usuario={usuario} />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

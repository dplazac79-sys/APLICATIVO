export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AppShell from '@/components/layout/AppShell'
import { Toaster } from 'sonner'

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
        rol: 'usuario_cliente',
      })
      .select()
      .single()
    usuario = nuevo
  }

  return (
    <AppShell usuario={usuario} rol={usuario?.rol ?? 'usuario_cliente'}>
      {children}
      <Toaster
        position="bottom-right"
        theme="dark"
        richColors
        closeButton
        toastOptions={{ duration: 5000 }}
      />
    </AppShell>
  )
}

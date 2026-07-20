import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { JourneyPortal } from './JourneyPortal'

export default async function PortalPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuario } = await supabase
    .from('usuario')
    .select('nombre, rol')
    .eq('id', user.id)
    .single()

  // Equipo interno va al dashboard
  if (usuario && !['sponsor_cliente', 'usuario_cliente'].includes(usuario.rol)) {
    redirect('/dashboard')
  }

  const { data: proyectos } = await supabase
    .from('proyecto')
    .select('id, nombre, estado_general, fase_actual, updated_at')
    .order('updated_at', { ascending: false })

  return (
    <JourneyPortal
      proyectos={proyectos ?? []}
      nombreUsuario={usuario?.nombre ?? 'bienvenido'}
    />
  )
}

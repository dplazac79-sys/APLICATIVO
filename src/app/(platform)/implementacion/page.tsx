export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ZonaImplementacion } from './ZonaImplementacion'

export default async function ImplementacionPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuario } = await supabase.from('usuario').select('nombre, rol').eq('id', user.id).single()
  if (!usuario) redirect('/login')

  // Solo clientes. Internos van al dashboard.
  if (!['sponsor_cliente', 'usuario_cliente'].includes(usuario.rol)) {
    redirect('/dashboard')
  }

  const { data: proyectos } = await supabase
    .from('proyecto')
    .select('id, nombre, estado_general, fase_actual')
    .order('updated_at', { ascending: false })

  // Procesos aprobados por proyecto
  const proyectoIds = (proyectos ?? []).map(p => p.id)
  let procesosAprobados: Array<{ id: string; nombre_proceso: string; macroproceso: string | null; numero_en_macroproceso: number | null; total_en_macroproceso: number | null; valor_negocio: string | null; aprobado_at: string | null; proyecto_id: string }> = []
  if (proyectoIds.length) {
    const { data } = await supabase
      .from('proceso_enriquecido')
      .select('id, nombre_proceso, macroproceso, numero_en_macroproceso, total_en_macroproceso, valor_negocio, aprobado_at, proyecto_id')
      .in('proyecto_id', proyectoIds)
      .eq('estado_aprobacion', 'aprobado')
      .order('aprobado_at', { ascending: false })
    procesosAprobados = data ?? []
  }

  return (
    <ZonaImplementacion
      proyectos={proyectos ?? []}
      procesosAprobados={procesosAprobados}
      nombreUsuario={usuario.nombre}
    />
  )
}

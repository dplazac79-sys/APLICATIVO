export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import HorizonteSimulador from '@/components/horizonte/HorizonteSimulador'

export default async function HorizontePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: usuario } = await admin
    .from('usuario')
    .select('rol, usuario_proyecto(proyecto_id)')
    .eq('id', user.id)
    .single()

  if (!usuario) redirect('/dashboard')

  // Determinar proyecto activo
  const esSuperAdmin = usuario.rol === 'super_admin'
  const proyectoIds = (usuario.usuario_proyecto ?? []).map((up: { proyecto_id: string }) => up.proyecto_id)

  let proyectoId: string | null = null
  if (esSuperAdmin) {
    const { data: p } = await admin.from('proyecto').select('id').eq('estado_general', 'activo').limit(1).single()
    proyectoId = p?.id ?? null
  } else {
    proyectoId = proyectoIds[0] ?? null
  }

  if (!proyectoId) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
        No hay proyecto activo asignado.
      </div>
    )
  }

  // Cargar datos del proyecto
  const { data: proyecto } = await admin
    .from('proyecto')
    .select('nombre, cliente:cliente_id(razon_social)')
    .eq('id', proyectoId)
    .single()

  const clienteNombre = ((proyecto?.cliente as unknown) as Record<string, string> | null)?.razon_social ?? ''

  // Procesos aceptados del proyecto
  const { data: procesosRaw } = await admin
    .from('proceso')
    .select('id, nombre, codigo')
    .eq('proyecto_id', proyectoId)
    .eq('estado_oferta', 'aceptado')
    .order('orden')

  const procesos = (procesosRaw ?? []) as Array<{ id: string; nombre: string; codigo: string | null }>

  if (procesos.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
        No hay procesos aceptados en este proyecto. Completa el Discovery primero.
      </div>
    )
  }

  // Artefactos por proceso
  const procesoIds = procesos.map(p => p.id)
  const { data: artefactosRaw } = await admin
    .from('artefacto')
    .select('id, tipo, version, proceso_id')
    .in('proceso_id', procesoIds)
    .eq('estado_validacion', 'publicado')
    .order('version', { ascending: false })

  const artefactosPorProceso: Record<string, Array<{ id: string; tipo: string; version: number }>> = {}
  for (const a of artefactosRaw ?? []) {
    const pid = (a as Record<string, string>).proceso_id
    if (!artefactosPorProceso[pid]) artefactosPorProceso[pid] = []
    artefactosPorProceso[pid].push({ id: a.id, tipo: a.tipo, version: a.version })
  }

  return (
    <HorizonteSimulador
      procesos={procesos.map(p => ({ id: p.id, nombre: p.nombre, codigo: p.codigo }))}
      artefactosPorProceso={artefactosPorProceso}
      proyectoNombre={proyecto?.nombre ?? ''}
      clienteNombre={clienteNombre}
    />
  )
}

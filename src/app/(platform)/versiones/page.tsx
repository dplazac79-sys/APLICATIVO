export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import VersionesCliente from '@/components/versiones/VersionesCliente'

export default async function VersionesPage() {
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

  const { data: proyecto } = await admin
    .from('proyecto')
    .select('nombre, cliente:cliente_id(razon_social)')
    .eq('id', proyectoId)
    .single()

  const clienteNombre = ((proyecto?.cliente as unknown) as Record<string, string> | null)?.razon_social ?? ''

  // Procesos aceptados
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
        No hay procesos aceptados en este proyecto.
      </div>
    )
  }

  const procesoIds = procesos.map(p => p.id)

  // Artefactos publicados (versión actual)
  const { data: artefactosRaw } = await admin
    .from('artefacto')
    .select('id, tipo, version, estado_validacion, updated_at, proceso_id')
    .in('proceso_id', procesoIds)
    .eq('estado_validacion', 'publicado')
    .order('updated_at', { ascending: false })

  // Historial de cambios
  const artefactoIds = (artefactosRaw ?? []).map(a => a.id)
  let historialRaw: Array<{
    id: string
    artefacto_id: string
    tipo: string
    version: number
    motivo_cambio: string | null
    created_at: string
    proceso_id: string
  }> = []

  if (artefactoIds.length > 0) {
    const { data: h } = await admin
      .from('artefacto_historial')
      .select('id, artefacto_id, tipo, version, motivo_cambio, created_at, proceso_id')
      .in('artefacto_id', artefactoIds)
      .order('created_at', { ascending: false })
    historialRaw = (h ?? []) as typeof historialRaw
  }

  return (
    <VersionesCliente
      procesos={procesos}
      artefactos={(artefactosRaw ?? []) as Array<{
        id: string
        tipo: string
        version: number
        estado_validacion: string
        updated_at: string
        proceso_id: string
      }>}
      historial={historialRaw}
      proyectoNombre={proyecto?.nombre ?? ''}
      clienteNombre={clienteNombre}
    />
  )
}

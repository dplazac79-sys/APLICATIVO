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
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
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

  // Todos los procesos aceptados, ordenados por orden y código
  const { data: procesosRaw } = await admin
    .from('proceso')
    .select('id, nombre, codigo, orden, estado_oferta, created_at, updated_at, metadata_ia, documento_origen_id')
    .eq('proyecto_id', proyectoId)
    .eq('estado_oferta', 'aceptado')

  // Sort by SC code number (same logic as Process Discovery)
  function scNumero(p: { codigo: string | null; metadata_ia: Record<string, unknown> | null; orden: number }): number {
    if (p.codigo) return parseInt(p.codigo.replace(/\D/g, ''), 10) || 9999
    const docRef = (p.metadata_ia?.documento_referencia as string | null)
    if (docRef) {
      const m = docRef.match(/(\d+)/)
      return m ? parseInt(m[1], 10) : 9999
    }
    return (p.orden ?? 0) + 1
  }
  const procesosOrdenados = [...(procesosRaw ?? [])].sort((a, b) => {
    const aa = a as { codigo: string | null; metadata_ia: Record<string, unknown> | null; orden: number }
    const bb = b as { codigo: string | null; metadata_ia: Record<string, unknown> | null; orden: number }
    return scNumero(aa) - scNumero(bb)
  })

  const procesos = procesosOrdenados as Array<{
    id: string
    nombre: string
    codigo: string | null
    orden: number
    estado_oferta: string
    created_at: string
    updated_at: string
    metadata_ia: Record<string, unknown> | null
    documento_origen_id: string | null
  }>

  // Fetch documento origen info for each proceso
  const docIds = procesos.map(p => p.documento_origen_id).filter(Boolean) as string[]
  const documentosMap: Record<string, { nombre_archivo: string; url_storage: string; tipo: string }> = {}
  if (docIds.length > 0) {
    const { data: docs } = await admin
      .from('documento')
      .select('id, nombre_archivo, url_storage, tipo')
      .in('id', docIds)
    for (const d of docs ?? []) {
      documentosMap[d.id] = { nombre_archivo: d.nombre_archivo, url_storage: d.url_storage, tipo: d.tipo }
    }
  }

  if (procesos.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-slate-400 text-sm">No hay procesos aceptados en este proyecto aún.</p>
          <p className="text-slate-400 text-xs">Completa el Process Discovery primero.</p>
        </div>
      </div>
    )
  }

  const procesoIds = procesos.map(p => p.id)

  // TODOS los artefactos (todos los estados, no solo publicado)
  const { data: artefactosRaw } = await admin
    .from('artefacto')
    .select('id, tipo, version, estado_validacion, updated_at, created_at, proceso_id, generado_por_ia')
    .in('proceso_id', procesoIds)
    .order('updated_at', { ascending: false })

  // Historial de artefactos
  const artefactoIds = (artefactosRaw ?? []).map(a => a.id)
  let historialArtefactosRaw: Array<{
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
    historialArtefactosRaw = (h ?? []) as typeof historialArtefactosRaw
  }

  // Historial de procesos (tabla proceso_historial si existe)
  let historialProcesosRaw: Array<{
    id: string
    proceso_id: string
    version: number
    tipo_cambio: string
    descripcion: string
    detalle: Record<string, unknown> | null
    created_at: string
  }> = []

  try {
    const { data: hp } = await admin
      .from('proceso_historial')
      .select('id, proceso_id, version, tipo_cambio, descripcion, detalle, created_at')
      .in('proceso_id', procesoIds)
      .order('created_at', { ascending: false })
    historialProcesosRaw = (hp ?? []) as typeof historialProcesosRaw
  } catch {
    // tabla puede no existir aún — ignorar
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
        created_at: string
        proceso_id: string
        generado_por_ia: boolean
      }>}
      historialArtefactos={historialArtefactosRaw}
      historialProcesos={historialProcesosRaw}
      documentosMap={documentosMap}
      proyectoNombre={proyecto?.nombre ?? ''}
      clienteNombre={clienteNombre}
      rol={usuario.rol}
    />
  )
}

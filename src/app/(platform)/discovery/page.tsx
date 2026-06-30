export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import DiscoveryExperiencia from '@/components/discovery/DiscoveryExperiencia'
import type { Proceso, Proyecto } from '@/types/database'

export default async function DiscoveryPage() {
  const admin = createAdminClient()

  const [{ data: proyectosRaw }, { data: procesos }] = await Promise.all([
    admin.from('proyecto').select('*, cliente(razon_social)').eq('estado_general', 'activo'),
    admin.from('proceso').select('*').order('nivel', { ascending: true }).order('orden', { ascending: true }),
  ])

  const proyectos = (proyectosRaw ?? []) as Array<Proyecto & { cliente: { razon_social: string } | null }>

  // Solo mostrar el primer proyecto activo (vista single-project)
  const proyecto = proyectos[0] ?? null

  if (!proyecto) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-violet-950/50 border border-violet-800/40 rounded-2xl flex items-center justify-center mx-auto text-3xl">🔍</div>
          <p className="text-white font-semibold">Sin proyectos activos</p>
          <p className="text-slate-400 text-sm">Crea un proyecto desde el onboarding para comenzar.</p>
        </div>
      </div>
    )
  }

  const procesosProyecto = (procesos ?? []).filter((p: Proceso) => p.proyecto_id === proyecto.id)
  const macroprocesosRaw = procesosProyecto.filter((p: Proceso) => p.nivel === 0)
  const subprocesos = procesosProyecto.filter((p: Proceso) => p.nivel === 1)

  const macroprocesos = macroprocesosRaw.map((macro: Proceso) => ({
    ...macro,
    hijos: subprocesos.filter((p: Proceso) => p.padre_id === macro.id),
  }))

  const aceptados = procesosProyecto.filter((p: Proceso) => p.estado_oferta === 'aceptado')
  const pendientes = procesosProyecto.filter((p: Proceso) => p.estado_oferta === 'propuesto')

  // Roles únicos de procesos aceptados para Glosario
  const rolesDetectados = Array.from(
    new Set(aceptados.flatMap((p: Proceso) => p.roles_involucrados ?? []))
  ).map((rol: string) => ({
    rol,
    descripcion: '',
    procesos: aceptados
      .filter((p: Proceso) => (p.roles_involucrados ?? []).includes(rol))
      .map((p: Proceso) => p.nombre),
  }))

  return (
    <DiscoveryExperiencia
      proyectoId={proyecto.id}
      nombreProyecto={proyecto.nombre}
      clienteNombre={proyecto.cliente?.razon_social ?? null}
      macroprocesos={macroprocesos as any}
      totalProcesos={procesosProyecto.length}
      aceptados={aceptados.length}
      pendientes={pendientes.length}
      rechazados={procesosProyecto.filter((p: Proceso) => p.estado_oferta === 'rechazado').length}
      resumenDiscovery={proyecto.discovery_resumen as Record<string, unknown> | null}
      rolesDetectados={rolesDetectados}
      proyectosParaAcciones={proyectos.map(p => ({ id: p.id, nombre: p.nombre }))}
    />
  )
}

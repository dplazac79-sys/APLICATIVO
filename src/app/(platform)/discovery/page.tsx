export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import DiscoveryExperiencia from '@/components/discovery/DiscoveryExperiencia'
import { getFasesProyecto } from '@/lib/fases'
import { obtenerRolesDesdeDocumentos } from '@/lib/domain/roles'
import type { Proceso, Proyecto } from '@/types/database'
import type { ProcesoConHijos, DocumentoItem } from '@/components/discovery/types'

const ROL_INTERNO = ['super_admin', 'director_proyecto', 'consultor']

export default async function DiscoveryPage() {
  const admin = createAdminClient()

  // Editar el nombre/descripción de un macroproceso o proceso es una acción
  // de la consultora (el macroproceso ya no lo decide la IA, así que
  // corregirlo es trabajo de super_admin/director_proyecto/consultor) — el
  // botón "Editar" de ProcesoCard no debe aparecer para roles cliente, que
  // de todas formas reciben 403 del backend si lo intentan usar.
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: usuarioActual } = user
    ? await admin.from('usuario').select('rol').eq('id', user.id).single()
    : { data: null }
  const rolActual = usuarioActual?.rol ?? 'usuario_cliente'
  const esInterno = ROL_INTERNO.includes(rolActual)

  // Antes esto traía TODOS los procesos y TODOS los documentos de la
  // plataforma entera (todos los clientes, todos los proyectos) y filtraba
  // al único proyecto que se muestra en esta vista (single-project) recién
  // en JS — el costo de la query escalaba con el tamaño de toda la
  // plataforma, no con el del proyecto. proyecto_id se conoce recién
  // después de resolver el proyecto activo, así que ya no se puede
  // paralelizar las 3 queries en un solo Promise.all — se resuelve primero
  // el proyecto, y proceso/documento se filtran por proyecto_id desde la BD.
  const { data: proyectosRaw } = await admin
    .from('proyecto').select('*, cliente(razon_social)').eq('estado_general', 'activo')

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

  const [{ data: procesos }, { data: documentosRaw }] = await Promise.all([
    admin.from('proceso').select('*').eq('proyecto_id', proyecto.id)
      .order('nivel', { ascending: true }).order('orden', { ascending: true }),
    admin.from('documento').select('id, nombre_archivo, tipo, estado_procesamiento, clasificacion, created_at, proyecto_id, subido_por(rol)')
      .eq('proyecto_id', proyecto.id).order('created_at', { ascending: false }),
  ])

  const procesosProyecto = (procesos ?? []) as Proceso[]
  const macroprocesosRaw = procesosProyecto.filter((p: Proceso) => p.nivel === 0)
  const subprocesos = procesosProyecto.filter((p: Proceso) => p.nivel === 1)

  function codigoOrden(p: Proceso): number {
    const ref = (p.metadata_ia as { documento_referencia?: string } | null)?.documento_referencia
    if (!ref) return 9999
    const match = ref.match(/(\d+)/)
    return match ? parseInt(match[1], 10) : 9999
  }

  const macroprocesos = macroprocesosRaw.map((macro: Proceso) => ({
    ...macro,
    hijos: subprocesos
      .filter((p: Proceso) => p.padre_id === macro.id)
      .sort((a: Proceso, b: Proceso) => codigoOrden(a) - codigoOrden(b)),
  }))

  const aceptados = procesosProyecto.filter((p: Proceso) => p.estado_oferta === 'aceptado' && p.nivel === 1)
  const pendientes = procesosProyecto.filter((p: Proceso) => p.estado_oferta === 'propuesto' && p.nivel === 1)
  // Solo nivel 1 (procesos hijos) para los contadores de origen
  const procesosNivel1 = procesosProyecto.filter((p: Proceso) => p.nivel === 1)
  const procesosDetectados = procesosNivel1.filter((p: Proceso) => p.origen === 'detectado').length
  const procesosPropeustosIA = procesosNivel1.filter((p: Proceso) => p.origen === 'propuesta_ia').length

  // Roles para Glosario — misma fuente y lógica que usa /api/portal/glosario-roles
  // al lanzar el análisis IA (documento.analisis_ia, no proceso.roles_involucrados).
  // Antes se derivaban de los procesos ACEPTADOS con descripción siempre vacía —
  // un dato que además nunca llegaba a usarse en el análisis real (el endpoint
  // recalcula los suyos desde los documentos e ignora lo que manda el cliente),
  // así que el badge del tab "Glosario de Roles" mostraba un conteo que no tenía
  // relación con lo que esa pestaña realmente iba a mostrar.
  const rolesDetectados = await obtenerRolesDesdeDocumentos(proyecto.id)

  const documentosProyecto = (documentosRaw ?? [])
    .filter((d: { subido_por: { rol: string } | { rol: string }[] | null }) => {
      const subidoPor = Array.isArray(d.subido_por) ? d.subido_por[0] : d.subido_por
      return !ROL_INTERNO.includes(subidoPor?.rol ?? '')
    })

  // Próximo paso — solo para roles cliente, y solo una vez que ya no queda
  // nada pendiente por revisar acá (mismo patrón que Centro Documental):
  // mientras haya procesos sin aceptar/rechazar, el propio panel de arriba
  // ya le dice al cliente qué hacer — el "siguiente paso" recién aplica
  // cuando terminó con esta fase.
  let faseActual: Awaited<ReturnType<typeof getFasesProyecto>>['fases'][number] | null = null
  if (!esInterno && procesosNivel1.length > 0 && pendientes.length === 0) {
    const { fases } = await getFasesProyecto(proyecto.id, rolActual)
    faseActual = fases.find(f => f.status === 'activa' && f.href !== '/discovery') ?? null
  }

  return (
    <DiscoveryExperiencia
      proyectoId={proyecto.id}
      nombreProyecto={proyecto.nombre}
      clienteNombre={proyecto.cliente?.razon_social ?? null}
      macroprocesos={macroprocesos as unknown as ProcesoConHijos[]}
      totalProcesos={procesosNivel1.length}
      aceptados={aceptados.length}
      pendientes={pendientes.length}
      rechazados={procesosProyecto.filter((p: Proceso) => p.estado_oferta === 'rechazado').length}
      procesosDetectados={procesosDetectados}
      procesosPropeustosIA={procesosPropeustosIA}
      resumenDiscovery={proyecto.discovery_resumen as Record<string, unknown> | null}
      rolesDetectados={rolesDetectados}
      proyectosParaAcciones={proyectos.map(p => ({ id: p.id, nombre: p.nombre }))}
      documentos={documentosProyecto as unknown as DocumentoItem[]}
      esInterno={esInterno}
      faseActual={faseActual}
    />
  )
}

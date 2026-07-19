import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Capa de dominio mínima para "procesos aceptados" y sus artefactos.
 *
 * Existe porque esta regla ("qué cuenta como proceso aceptado", "qué artefactos
 * cuentan como generados") estaba reimplementada de forma independiente en al
 * menos 15 archivos. Tres de ellos (Dashboard, Bienvenida, lib/fases.ts) habían
 * divergido silenciosamente: dos filtraban artefactos por proceso.estado_oferta
 * === 'aceptado' y uno no, mostrando 56 vs 48 "artefactos generados" para el
 * mismo proyecto en pantallas distintas del mismo producto.
 *
 * Cualquier pantalla nueva que necesite "procesos aceptados" o "artefactos de
 * procesos aceptados" debe usar estas funciones en vez de reimplementar el
 * filtro — es la única forma de que las cinco pantallas que muestran este
 * número no vuelvan a desincronizarse.
 */

export interface ProcesoAceptadoIds {
  ids: string[]
  total: number
}

/** IDs de procesos con estado_oferta = 'aceptado' para un proyecto. */
export async function getProcesosAceptadosIds(proyectoId: string): Promise<ProcesoAceptadoIds> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('proceso')
    .select('id')
    .eq('proyecto_id', proyectoId)
    .eq('estado_oferta', 'aceptado')

  const ids = (data ?? []).map(p => p.id)
  return { ids, total: ids.length }
}

/** Cantidad de artefactos que pertenecen a procesos aceptados de un proyecto. */
export async function contarArtefactosDeProcesosAceptados(proyectoId: string): Promise<number> {
  const { ids } = await getProcesosAceptadosIds(proyectoId)
  if (ids.length === 0) return 0

  const admin = createAdminClient()
  const { count } = await admin
    .from('artefacto')
    .select('id', { count: 'exact', head: true })
    .in('proceso_id', ids)

  return count ?? 0
}

export interface ModificacionesCount {
  documentos: number
  artefactos: number
  total: number
}

/**
 * Cuenta todas las modificaciones reales incorporadas a procesos aceptados:
 * cambios de documento (metadata_ia.versiones[].detalle_correcciones, la
 * misma fuente que usa Control de Versiones) + ediciones de artefacto
 * (artefacto_historial). Es el mismo dato que se muestra en detalle en
 * Control de Versiones, agregado acá como un solo número para el Dashboard.
 */
export async function contarModificacionesDeProcesosAceptados(proyectoId: string): Promise<ModificacionesCount> {
  const { ids } = await getProcesosAceptadosIds(proyectoId)
  if (ids.length === 0) return { documentos: 0, artefactos: 0, total: 0 }

  const admin = createAdminClient()
  const [procesosRes, historialRes] = await Promise.all([
    admin.from('proceso').select('metadata_ia').in('id', ids),
    admin.from('artefacto_historial').select('id', { count: 'exact', head: true }).in('proceso_id', ids),
  ])

  const documentos = (procesosRes.data ?? []).reduce((sum, p) => {
    const versiones = ((p.metadata_ia as Record<string, unknown> | null)?.versiones ?? []) as Array<{ detalle_correcciones?: unknown[] }>
    return sum + versiones.reduce((s, v) => s + (v.detalle_correcciones?.length ?? 0), 0)
  }, 0)

  const artefactos = historialRes.count ?? 0

  return { documentos, artefactos, total: documentos + artefactos }
}

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

export interface ArtefactosAprobadosCount {
  aprobados: number
  total: number
}

/**
 * Cuenta cuántos artefactos de procesos aceptados están aprobados
 * (estado_validacion 'validado' o 'publicado') vs el total — mismo criterio
 * de "aprobado" que usa la pantalla de Artefactos, para que el ring de
 * salud del Dashboard no invente su propia definición.
 */
export async function contarArtefactosAprobadosDeProcesosAceptados(proyectoId: string): Promise<ArtefactosAprobadosCount> {
  const { ids } = await getProcesosAceptadosIds(proyectoId)
  if (ids.length === 0) return { aprobados: 0, total: 0 }

  const admin = createAdminClient()
  const { data } = await admin
    .from('artefacto')
    .select('estado_validacion')
    .in('proceso_id', ids)

  const total = data?.length ?? 0
  const aprobados = (data ?? []).filter(a => a.estado_validacion === 'validado' || a.estado_validacion === 'publicado').length

  return { aprobados, total }
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

/**
 * Fecha (ISO) de la modificación más reciente sobre procesos aceptados —
 * misma fuente de "actividad real" que usa Control de Versiones (artefacto.
 * updated_at + artefacto_historial.created_at), para que el Dashboard pueda
 * mostrar "hace X" sin duplicar la lógica de agregación completa del timeline.
 */
export async function obtenerUltimaActividadDeProcesosAceptados(proyectoId: string): Promise<string | null> {
  const { ids } = await getProcesosAceptadosIds(proyectoId)
  if (ids.length === 0) return null

  const admin = createAdminClient()
  const [artefactoRes, historialRes] = await Promise.all([
    admin.from('artefacto').select('updated_at').in('proceso_id', ids).order('updated_at', { ascending: false }).limit(1),
    admin.from('artefacto_historial').select('created_at').in('proceso_id', ids).order('created_at', { ascending: false }).limit(1),
  ])

  const candidatos = [artefactoRes.data?.[0]?.updated_at, historialRes.data?.[0]?.created_at].filter(Boolean) as string[]
  if (candidatos.length === 0) return null

  return candidatos.reduce((latest, d) => (new Date(d).getTime() > new Date(latest).getTime() ? d : latest))
}

export interface HitoReciente {
  origen: 'documento' | 'artefacto'
  tipo: string
  texto: string
  fecha: string
  procesoCodigo: string
}

/**
 * Últimos N hitos reales sobre procesos aceptados, combinando cambios de
 * documento (detalle_correcciones) y ediciones de artefacto — misma fuente y
 * misma unión que Control de Versiones, recortada a los más recientes para
 * un feed compacto en el Dashboard en vez del timeline completo.
 */
export async function obtenerHitosRecientesDeProcesosAceptados(proyectoId: string, limite = 3): Promise<HitoReciente[]> {
  const { ids } = await getProcesosAceptadosIds(proyectoId)
  if (ids.length === 0) return []

  const admin = createAdminClient()
  const [procesosRes, historialRes] = await Promise.all([
    admin.from('proceso').select('id, codigo, orden, metadata_ia').in('id', ids),
    admin.from('artefacto_historial').select('tipo, motivo_cambio, created_at, proceso_id').in('proceso_id', ids).order('created_at', { ascending: false }).limit(limite),
  ])

  const codigoPorProceso: Record<string, string> = {}
  const hitos: HitoReciente[] = []

  for (const p of procesosRes.data ?? []) {
    const meta = p.metadata_ia as Record<string, unknown> | null
    const codigo = p.codigo ?? `SC${String((p.orden ?? 0) + 1).padStart(2, '0')}`
    codigoPorProceso[p.id] = codigo

    const versiones = (meta?.versiones ?? []) as Array<{ detalle_correcciones?: Array<{ tipo?: string; observacion?: string; fecha?: string }> }>
    for (const v of versiones) {
      for (const c of v.detalle_correcciones ?? []) {
        if (!c.fecha) continue
        hitos.push({ origen: 'documento', tipo: c.tipo ?? 'proceso', texto: c.observacion?.trim() || 'Cambio incorporado al documento', fecha: c.fecha, procesoCodigo: codigo })
      }
    }
  }

  for (const h of historialRes.data ?? []) {
    hitos.push({
      origen: 'artefacto',
      tipo: h.tipo,
      texto: h.motivo_cambio?.trim() || 'Edición sin motivo registrado',
      fecha: h.created_at,
      procesoCodigo: codigoPorProceso[h.proceso_id] ?? '',
    })
  }

  return hitos
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .slice(0, limite)
}

export interface SimulacionResumen {
  procesoCodigo: string
  headline: string
  ahorroAnualClp: number
  reduccionTiempoPorcentaje: number
  fecha: string
}

/**
 * Última simulación de Horizonte de Impacto guardada (tabla `simulacion`)
 * sobre un proceso aceptado del proyecto — solo el equipo consultor puede
 * guardar simulaciones (ver /api/horizonte/simulaciones), así que puede no
 * existir ninguna; el Dashboard debe manejar el caso null sin romper.
 */
export async function obtenerUltimaSimulacionDeProcesosAceptados(proyectoId: string): Promise<SimulacionResumen | null> {
  const { ids } = await getProcesosAceptadosIds(proyectoId)
  if (ids.length === 0) return null

  const admin = createAdminClient()
  const { data } = await admin
    .from('simulacion')
    .select('resultados, created_at, proceso:proceso_id(codigo, nombre)')
    .in('proceso_id', ids)
    .order('created_at', { ascending: false })
    .limit(1)

  const row = data?.[0]
  if (!row) return null

  const r = (row.resultados ?? {}) as Record<string, unknown>
  const proc = (row.proceso as unknown) as { codigo: string | null; nombre: string } | null

  return {
    procesoCodigo: proc?.codigo ?? proc?.nombre ?? '',
    headline: (r.headline as string) ?? '',
    ahorroAnualClp: (r.ahorro_anual_clp as number) ?? 0,
    reduccionTiempoPorcentaje: (r.reduccion_tiempo_porcentaje as number) ?? 0,
    fecha: row.created_at,
  }
}

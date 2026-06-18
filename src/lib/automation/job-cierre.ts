import { createAdminClient } from '@/lib/supabase/admin'
import type { KgPatronItem, KgAutomatizacionPatron, TipoAutomatizacion, KgNodoTipo, KgTipoRelacion } from './tipos'

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Extrae patrones de un proyecto cerrado y los agrega al Knowledge Graph.
 * Se invoca desde la API cuando proyecto.estado_general pasa a 'cerrado'.
 */
export async function ejecutarCierreProyecto(proyectoId: string, jobId: string): Promise<void> {
  const admin = createAdminClient()

  // Marcar job como procesando
  await admin.from('kg_job_cierre').update({
    estado: 'procesando',
    iniciado_en: new Date().toISOString(),
  }).eq('id', jobId)

  try {
    // 1. Obtener datos del proyecto
    const { data: proyecto } = await admin
      .from('proyecto')
      .select('id, nombre, cliente_id, cliente:cliente_id(industria)')
      .eq('id', proyectoId)
      .single()

    const industria = (proyecto?.cliente as { industria?: string } | null)?.industria ?? 'Sin clasificar'

    // 2. Extraer procesos aceptados
    const { data: procesos } = await admin
      .from('proceso')
      .select('id, nombre, tipo')
      .eq('proyecto_id', proyectoId)
      .eq('estado_oferta', 'aceptado')

    const procesosPatron: KgPatronItem[] = (procesos ?? []).map(p => ({
      nombre: p.nombre,
      frecuencia: 1,
      tipo: p.tipo,
    }))

    // 3. Extraer riesgos
    const { data: riesgos } = await admin
      .from('riesgo')
      .select('nombre, tipo')
      .eq('proyecto_id', proyectoId)

    const riesgosPatron: KgPatronItem[] = (riesgos ?? []).map(r => ({
      nombre: r.nombre ?? 'Sin nombre',
      frecuencia: 1,
      tipo: r.tipo ?? '',
    }))

    // 4. Extraer KPIs
    const { data: kpis } = await admin
      .from('kpi')
      .select('nombre')
      .eq('proyecto_id', proyectoId)

    const kpisPatron: KgPatronItem[] = (kpis ?? []).map(k => ({
      nombre: k.nombre,
      frecuencia: 1,
    }))

    // 5. Extraer recomendaciones de automatización aprobadas
    const { data: recsAprobadas } = await admin
      .from('kg_recomendacion')
      .select('tipo_automatizacion, herramientas, score_impacto, proceso_id')
      .eq('proyecto_id', proyectoId)
      .eq('estado', 'aprobada')

    const autPatrones: KgAutomatizacionPatron[] = (recsAprobadas ?? []).map(r => ({
      tipo: r.tipo_automatizacion as TipoAutomatizacion,
      herramientas: r.herramientas ?? [],
      frecuencia: 1,
      score_promedio: r.score_impacto ?? 3,
    }))

    // 6. Leer snapshot actual de la industria y hacer merge
    const { data: snapshotExistente } = await admin
      .from('kg_industria_snapshot')
      .select('*')
      .eq('industria', industria)
      .single()

    const nuevoSnapshot = mergeSnapshot(
      snapshotExistente,
      procesosPatron,
      riesgosPatron,
      kpisPatron,
      autPatrones,
    )

    // 7. Upsert del snapshot
    await admin.from('kg_industria_snapshot').upsert({
      industria,
      procesos_frecuentes: nuevoSnapshot.procesos_frecuentes,
      riesgos_frecuentes: nuevoSnapshot.riesgos_frecuentes,
      kpis_frecuentes: nuevoSnapshot.kpis_frecuentes,
      automatizaciones: nuevoSnapshot.automatizaciones,
      proyectos_cerrados: (snapshotExistente?.proyectos_cerrados ?? 0) + 1,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'industria' })

    // 7b. Poblar el Knowledge Graph relacional (nodos + relaciones)
    await poblarGrafoRelacional(admin, industria, {
      procesos: (procesos ?? []).map(p => ({ id: p.id, nombre: p.nombre })),
      riesgos: riesgosPatron.map(r => r.nombre),
      kpis: kpisPatron.map(k => k.nombre),
      recomendaciones: (recsAprobadas ?? []).map(r => ({
        tipo: r.tipo_automatizacion as TipoAutomatizacion,
        herramientas: r.herramientas ?? [],
        proceso_id: (r as { proceso_id?: string | null }).proceso_id ?? null,
      })),
    })

    // 8. Completar job
    await admin.from('kg_job_cierre').update({
      estado: 'completado',
      completado_en: new Date().toISOString(),
      resultado: {
        industria,
        procesos_extraidos: procesosPatron.length,
        riesgos_extraidos: riesgosPatron.length,
        kpis_extraidos: kpisPatron.length,
        automatizaciones_extraidas: autPatrones.length,
      },
    }).eq('id', jobId)

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    await admin.from('kg_job_cierre').update({
      estado: 'error',
      error_msg: msg,
      completado_en: new Date().toISOString(),
    }).eq('id', jobId)
    throw err
  }
}

interface GrafoInput {
  procesos: { id: string; nombre: string }[]
  riesgos: string[]
  kpis: string[]
  recomendaciones: { tipo: TipoAutomatizacion; herramientas: string[]; proceso_id: string | null }[]
}

/**
 * Upsert de un nodo: incrementa frecuencia si ya existe (por industria+tipo+nombre).
 * Devuelve el id del nodo.
 */
async function upsertNodo(
  admin: AdminClient,
  industria: string,
  tipo: KgNodoTipo,
  nombre: string,
): Promise<string | null> {
  const limpio = (nombre ?? '').trim()
  if (!limpio) return null

  // Buscar nodo existente (clave única industria+tipo+nombre).
  const { data: existente } = await admin
    .from('kg_nodo')
    .select('id, frecuencia')
    .eq('industria', industria).eq('tipo', tipo).eq('nombre', limpio)
    .maybeSingle()

  if (existente) {
    // Equivalente a: on conflict (industria, tipo, nombre) do update set frecuencia = frecuencia + 1
    await admin.from('kg_nodo')
      .update({ frecuencia: existente.frecuencia + 1 })
      .eq('id', existente.id)
    return existente.id
  }

  const { data: nuevo } = await admin
    .from('kg_nodo')
    .insert({ industria, tipo, nombre: limpio })
    .select('id')
    .single()
  return nuevo?.id ?? null
}

async function upsertRelacion(
  admin: AdminClient,
  origen: string | null,
  destino: string | null,
  tipo: KgTipoRelacion,
): Promise<void> {
  if (!origen || !destino) return
  await admin.from('kg_relacion').upsert(
    { nodo_origen: origen, nodo_destino: destino, tipo_relacion: tipo },
    { onConflict: 'nodo_origen,nodo_destino,tipo_relacion', ignoreDuplicates: true },
  )
}

async function poblarGrafoRelacional(
  admin: AdminClient,
  industria: string,
  input: GrafoInput,
): Promise<void> {
  // Nodos de proceso (mapeo proceso_id -> nodo_id)
  const procesoNodo = new Map<string, string>()
  let primerProcesoNodo: string | null = null
  for (const p of input.procesos) {
    const nodoId = await upsertNodo(admin, industria, 'proceso', p.nombre)
    if (nodoId) {
      procesoNodo.set(p.id, nodoId)
      if (!primerProcesoNodo) primerProcesoNodo = nodoId
    }
  }

  // Nodos de riesgo
  const riesgoNodos: string[] = []
  for (const r of input.riesgos) {
    const id = await upsertNodo(admin, industria, 'riesgo', r)
    if (id) riesgoNodos.push(id)
  }

  // Nodos de KPI + relación proceso -> genera -> kpi
  for (const k of input.kpis) {
    const kpiId = await upsertNodo(admin, industria, 'kpi', k)
    if (kpiId && primerProcesoNodo) {
      await upsertRelacion(admin, primerProcesoNodo, kpiId, 'genera')
    }
  }

  // Automatizaciones aprobadas + herramientas + relaciones
  for (const rec of input.recomendaciones) {
    const autId = await upsertNodo(admin, industria, 'automatizacion', rec.tipo)
    if (!autId) continue

    // proceso -> usa -> automatizacion (proceso vinculado o el primero como fallback)
    const procNodo = (rec.proceso_id && procesoNodo.get(rec.proceso_id)) || primerProcesoNodo
    await upsertRelacion(admin, procNodo, autId, 'usa')

    // automatizacion -> usa -> herramienta
    for (const h of rec.herramientas) {
      const herrId = await upsertNodo(admin, industria, 'herramienta', h)
      await upsertRelacion(admin, autId, herrId, 'usa')
    }

    // automatizacion -> mitiga -> riesgo (la automatización reduce riesgos del proceso)
    for (const riesgoId of riesgoNodos) {
      await upsertRelacion(admin, autId, riesgoId, 'mitiga')
    }
  }
}

function mergeSnapshot(
  existente: Record<string, unknown> | null,
  procesos: KgPatronItem[],
  riesgos: KgPatronItem[],
  kpis: KgPatronItem[],
  automatizaciones: KgAutomatizacionPatron[],
) {
  return {
    procesos_frecuentes: mergeItems(
      (existente?.procesos_frecuentes as KgPatronItem[]) ?? [],
      procesos,
    ),
    riesgos_frecuentes: mergeItems(
      (existente?.riesgos_frecuentes as KgPatronItem[]) ?? [],
      riesgos,
    ),
    kpis_frecuentes: mergeItems(
      (existente?.kpis_frecuentes as KgPatronItem[]) ?? [],
      kpis,
    ),
    automatizaciones: mergeAutomatizaciones(
      (existente?.automatizaciones as KgAutomatizacionPatron[]) ?? [],
      automatizaciones,
    ),
  }
}

function mergeItems(existentes: KgPatronItem[], nuevos: KgPatronItem[]): KgPatronItem[] {
  const map = new Map<string, KgPatronItem>()
  for (const item of existentes) map.set(item.nombre, { ...item })
  for (const item of nuevos) {
    const ex = map.get(item.nombre)
    if (ex) ex.frecuencia += 1
    else map.set(item.nombre, { ...item })
  }
  return Array.from(map.values()).sort((a, b) => b.frecuencia - a.frecuencia).slice(0, 20)
}

function mergeAutomatizaciones(
  existentes: KgAutomatizacionPatron[],
  nuevas: KgAutomatizacionPatron[],
): KgAutomatizacionPatron[] {
  const map = new Map<string, KgAutomatizacionPatron>()
  for (const item of existentes) map.set(item.tipo, { ...item })
  for (const item of nuevas) {
    const ex = map.get(item.tipo)
    if (ex) {
      ex.frecuencia += 1
      ex.score_promedio = (ex.score_promedio + item.score_promedio) / 2
      ex.herramientas = Array.from(new Set([...ex.herramientas, ...item.herramientas]))
    } else {
      map.set(item.tipo, { ...item })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.frecuencia - a.frecuencia)
}

/**
 * Test E2E: Trazabilidad completa — DoD Fase 6
 * documento → proceso → artefacto → simulación → recomendación → roadmap → entregable
 *
 * Verifica que la cadena de trazabilidad de APIP se mantiene íntegra de punta a punta.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { simularOperacional } from '@/lib/simulacion/operacional'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let clienteId: string
let proyectoId: string
let documentoId: string
let procesoId: string
let artefactoAsisId: string
let artefactoTobeId: string
let simulacionId: string
let recomendacionId: string
let roadmapId: string
let entregableId: string

const TEST_TAG = 'e2e-trazabilidad-' + Date.now()

describe('Trazabilidad completa: documento → proceso → artefacto → simulación → recomendación → entregable', () => {

  beforeAll(async () => {
    const { data: c } = await admin.from('cliente').insert({
      razon_social: `Cliente ${TEST_TAG}`,
      industria: 'Manufactura',
      tamano: 'mediana',
    }).select().single()
    clienteId = c!.id

    const { data: p } = await admin.from('proyecto').insert({
      cliente_id: clienteId,
      nombre: `Proyecto ${TEST_TAG}`,
      estado_general: 'activo',
    }).select().single()
    proyectoId = p!.id
  })

  afterAll(async () => {
    if (entregableId) await admin.from('entregable').delete().eq('id', entregableId)
    if (roadmapId) await admin.from('kg_roadmap').delete().eq('id', roadmapId)
    if (recomendacionId) await admin.from('kg_recomendacion').delete().eq('id', recomendacionId)
    if (simulacionId) await admin.from('simulacion').delete().eq('id', simulacionId)
    if (artefactoAsisId) await admin.from('artefacto').delete().eq('id', artefactoAsisId)
    if (artefactoTobeId) await admin.from('artefacto').delete().eq('id', artefactoTobeId)
    if (procesoId) await admin.from('proceso').delete().eq('id', procesoId)
    if (documentoId) await admin.from('documento').delete().eq('id', documentoId)
    if (proyectoId) await admin.from('proyecto').delete().eq('id', proyectoId)
    if (clienteId) await admin.from('cliente').delete().eq('id', clienteId)
  })

  // ── Eslabón 1: Documento ─────────────────────────────────────────────────
  it('eslabón 1 — crea documento de origen', async () => {
    const { data: doc, error } = await admin.from('documento').insert({
      proyecto_id: proyectoId,
      nombre: `Manual de Compras ${TEST_TAG}.pdf`,
      tipo_archivo: 'pdf',
      estado_procesamiento: 'listo',
      clasificacion: 'proceso',
      resumen_ejecutivo: 'Descripción del proceso de compras actual con 6 horas de ciclo.',
    }).select().single()

    expect(error).toBeNull()
    documentoId = doc!.id
    expect(doc!.estado_procesamiento).toBe('listo')
  })

  // ── Eslabón 2: Proceso vinculado al documento ────────────────────────────
  it('eslabón 2 — crea proceso referenciando el documento', async () => {
    const { data: proc, error } = await admin.from('proceso').insert({
      proyecto_id: proyectoId,
      nombre: 'Proceso de Compras E2E',
      tipo: 'proceso',
      nivel: 1,
      origen: 'detectado',
      estado_oferta: 'aceptado',
      documento_origen_id: documentoId,
    }).select().single()

    expect(error).toBeNull()
    procesoId = proc!.id
    expect(proc!.documento_origen_id).toBe(documentoId)
    expect(proc!.origen).toBe('detectado')
  })

  // ── Eslabón 3: Artefactos AS-IS y TO-BE ─────────────────────────────────
  it('eslabón 3 — crea artefactos AS-IS y TO-BE con enum correcto', async () => {
    const { data: asis, error: eAsis } = await admin.from('artefacto').insert({
      proceso_id: procesoId,
      proyecto_id: proyectoId,
      tipo: 'as_is',
      estado_validacion: 'pendiente',
      contenido: { pasos: ['Solicitud manual', 'Revisión en papel', 'Aprobación presencial'] },
    }).select().single()

    expect(eAsis).toBeNull()
    artefactoAsisId = asis!.id
    expect(asis!.tipo).toBe('as_is')

    const { data: tobe, error: eTobe } = await admin.from('artefacto').insert({
      proceso_id: procesoId,
      proyecto_id: proyectoId,
      tipo: 'to_be',
      estado_validacion: 'pendiente',
      contenido: {
        pasos: ['Solicitud digital', 'Aprobación automática por reglas', 'Notificación'],
        mejoras: ['Eliminación de papel', 'Aprobaciones automáticas < 5 min'],
        herramientas_sugeridas: ['RPA', 'Portal de solicitudes'],
      },
    }).select().single()

    expect(eTobe).toBeNull()
    artefactoTobeId = tobe!.id
    expect(tobe!.tipo).toBe('to_be')
  })

  // ── Eslabón 4: Simulación con motor real ─────────────────────────────────
  it('eslabón 4 — simulación operacional usa motor real y es determinista', async () => {
    const parametros = {
      tiempo_ciclo_asis_horas: 6,
      throughput_asis_unidades_dia: 8,
      carga_trabajo_asis_ftes: 3,
      mejora_tiempo_ciclo_pct: 35,
      mejora_throughput_pct: 25,
      multiplicador_custom: 0.6,
    }

    // Verificar determinismo: optimista ≥ base ≥ conservador
    const resultados_todos = simularOperacional(parametros)
    expect(resultados_todos.optimista.ftes_liberados)
      .toBeGreaterThanOrEqual(resultados_todos.base.ftes_liberados)
    expect(resultados_todos.base.ftes_liberados)
      .toBeGreaterThanOrEqual(resultados_todos.conservador.ftes_liberados)
    expect(resultados_todos.optimista.tiempo_ciclo_tobe_horas)
      .toBeLessThanOrEqual(resultados_todos.base.tiempo_ciclo_tobe_horas)
    expect(resultados_todos.base.tiempo_ciclo_tobe_horas)
      .toBeLessThanOrEqual(resultados_todos.conservador.tiempo_ciclo_tobe_horas)

    const { data: sim, error } = await admin.from('simulacion').insert({
      proyecto_id: proyectoId,
      proceso_id: procesoId,
      artefacto_asis_id: artefactoAsisId,
      artefacto_tobe_id: artefactoTobeId,
      nombre: `Simulación E2E ${TEST_TAG}`,
      tipo: 'operacional',
      escenario: 'base',
      parametros,
      resultados: resultados_todos.base,
      resultados_todos,
    }).select().single()

    expect(error).toBeNull()
    simulacionId = sim!.id
    expect(sim!.proceso_id).toBe(procesoId)
    expect(sim!.artefacto_asis_id).toBe(artefactoAsisId)
    expect(sim!.artefacto_tobe_id).toBe(artefactoTobeId)
  })

  // ── Eslabón 5: Recomendación trazable ────────────────────────────────────
  it('eslabón 5 — recomendación vinculada a simulación y TO-BE', async () => {
    const { data: rec, error } = await admin.from('kg_recomendacion').insert({
      proyecto_id: proyectoId,
      proceso_id: procesoId,
      simulacion_id: simulacionId,
      artefacto_tobe_id: artefactoTobeId,
      tipo_automatizacion: 'RPA',
      herramientas: ['UiPath', 'Power Automate'],
      justificacion: 'El AS-IS tiene 3 pasos manuales automatizables. Simulación base proyecta 35% reducción de ciclo.',
      score_impacto: 4,
      score_esfuerzo: 2,
      estado: 'sugerida',
    }).select().single()

    expect(error).toBeNull()
    recomendacionId = rec!.id
    expect(rec!.simulacion_id).toBe(simulacionId)
    expect(rec!.artefacto_tobe_id).toBe(artefactoTobeId)
    expect(Number(rec!.prioridad)).toBeCloseTo(2.0, 1)
  })

  // ── Eslabón 6: Roadmap ────────────────────────────────────────────────────
  it('eslabón 6 — roadmap consolida recomendaciones', async () => {
    const { data: roadmap, error } = await admin.from('kg_roadmap').insert({
      proyecto_id: proyectoId,
      nombre: `Roadmap E2E ${TEST_TAG}`,
      estado: 'borrador',
    }).select().single()

    expect(error).toBeNull()
    roadmapId = roadmap!.id

    await admin.from('kg_recomendacion')
      .update({ roadmap_id: roadmapId, estado: 'aprobada' })
      .eq('id', recomendacionId)

    const { data: rec } = await admin.from('kg_recomendacion')
      .select('roadmap_id, estado').eq('id', recomendacionId).single()

    expect(rec!.roadmap_id).toBe(roadmapId)
    expect(rec!.estado).toBe('aprobada')
  })

  // ── Eslabón 7: Entregable exportado ──────────────────────────────────────
  it('eslabón 7 — roadmap exportado como entregable con trazabilidad completa', async () => {
    const { data: recsDelRoadmap } = await admin
      .from('kg_recomendacion').select('*').eq('roadmap_id', roadmapId)

    const { data: ent, error } = await admin.from('entregable').insert({
      proyecto_id: proyectoId,
      tipo: 'reporte',
      nombre: `Roadmap de Automatización — E2E ${TEST_TAG}`,
      version: 1,
      estado: 'aprobado',
      contenido: {
        roadmap_id: roadmapId,
        recomendaciones: recsDelRoadmap,
        exportado_en: new Date().toISOString(),
      },
    }).select().single()

    expect(error).toBeNull()
    entregableId = ent!.id

    await admin.from('kg_roadmap')
      .update({ entregable_id: entregableId, estado: 'exportado' })
      .eq('id', roadmapId)

    const { data: rdm } = await admin.from('kg_roadmap')
      .select('estado, entregable_id').eq('id', roadmapId).single()

    expect(rdm!.estado).toBe('exportado')
    expect(rdm!.entregable_id).toBe(entregableId)
  })

  // ── Verificación de cadena completa ──────────────────────────────────────
  it('cadena completa: documento → proceso → artefacto → sim → rec → entregable es trazable en un query', async () => {
    const { data: rec } = await admin
      .from('kg_recomendacion')
      .select(`
        id, tipo_automatizacion, estado, roadmap_id,
        simulacion:simulacion_id (
          id, tipo,
          proceso:proceso_id (id, nombre, documento_origen_id),
          artefacto_asis:artefacto_asis_id (id, tipo),
          artefacto_tobe:artefacto_tobe_id (id, tipo)
        ),
        artefacto_tobe:artefacto_tobe_id (id, tipo, proceso_id)
      `)
      .eq('id', recomendacionId)
      .single()

    expect(rec).toBeTruthy()

    const sim = rec!.simulacion as unknown as Record<string, unknown>
    expect(sim).toBeTruthy()

    const proceso = sim.proceso as Record<string, unknown>
    expect(proceso.documento_origen_id).toBe(documentoId)
    expect(proceso.id).toBe(procesoId)

    const asis = sim.artefacto_asis as Record<string, unknown>
    expect(asis.tipo).toBe('as_is')

    const tobe = sim.artefacto_tobe as Record<string, unknown>
    expect(tobe.tipo).toBe('to_be')

    expect(rec!.roadmap_id).toBe(roadmapId)
  })
})

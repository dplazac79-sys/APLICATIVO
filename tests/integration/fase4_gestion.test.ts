/**
 * Tests de integración — Fase 4: Gestión de Proyecto
 * Run: npm run test:integration
 * Requiere: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY en .env.local
 *
 * proceso.tipo válidos: 'macroproceso'|'proceso'|'subproceso'|'actividad'|'tarea'
 * kpi.linea_base / kpi.meta son TEXT (no number)
 * cliente no tiene columna 'pais'
 * nivel_riesgo se calcula en el route handler — en tests directos a BD se fija manualmente
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { TRANSICIONES_VALIDAS } from '@/types/database'
import type { WorkflowEstadoTipo } from '@/types/database'

const hasCredenciales = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'fake',
)

describe('Fase 4 — Gestión de Proyecto', () => {
  let clienteId: string
  let proyectoId: string
  let procesoId: string

  beforeAll(async () => {
    if (!hasCredenciales) return

    const { data: cliente } = await admin.from('cliente').insert({
      razon_social: 'Test Gestión SA',
      industria: 'Testing',
    }).select().single()
    clienteId = cliente!.id

    const { data: proyecto } = await admin.from('proyecto').insert({
      nombre: 'Test Fase 4',
      cliente_id: clienteId,
      estado_general: 'activo',
    }).select().single()
    proyectoId = proyecto!.id

    const { data: proceso } = await admin.from('proceso').insert({
      nombre: 'Proceso Test WF',
      proyecto_id: proyectoId,
      nivel: 0,
      tipo: 'proceso',       // enum válido: macroproceso|proceso|subproceso|actividad|tarea
      origen: 'manual',      // enum válido: detectado|propuesta_ia|manual
      estado_oferta: 'aceptado',
    }).select().single()
    procesoId = proceso!.id
  })

  afterAll(async () => {
    if (!hasCredenciales) return
    await admin.from('workflow_estado').delete().eq('proceso_id', procesoId)
    await admin.from('notificacion').delete().eq('proyecto_id', proyectoId)
    await admin.from('reunion').delete().eq('proyecto_id', proyectoId)
    await admin.from('riesgo').delete().eq('proyecto_id', proyectoId)
    await admin.from('kpi').delete().eq('proyecto_id', proyectoId)
    await admin.from('proceso').delete().eq('id', procesoId)
    await admin.from('proyecto').delete().eq('id', proyectoId)
    await admin.from('cliente').delete().eq('id', clienteId)
  })

  // ── Máquina de estados (unit — sin BD) ──────────────────────

  it('TRANSICIONES_VALIDAS cubre los 7 estados', () => {
    const estados: WorkflowEstadoTipo[] = [
      'Scheduled', 'Assigned', 'In Progress',
      'Pending Approval', 'Approved', 'Implemented', 'Closed',
    ]
    for (const estado of estados) {
      expect(TRANSICIONES_VALIDAS[estado]).toBeDefined()
    }
  })

  it('transición Scheduled → Assigned es válida; Scheduled → Approved no lo es', () => {
    expect(TRANSICIONES_VALIDAS['Scheduled']).toContain('Assigned')
    expect(TRANSICIONES_VALIDAS['Scheduled']).not.toContain('Approved')
  })

  it('Closed → Scheduled es la única reapertura permitida', () => {
    expect(TRANSICIONES_VALIDAS['Closed']).toEqual(['Scheduled'])
  })

  // ── workflow_estado ──────────────────────────────────────────

  it('se puede crear un workflow_estado con estado Scheduled', async () => {
    if (!hasCredenciales) return

    const { data, error } = await admin.from('workflow_estado').insert({
      proceso_id: procesoId,
      proyecto_id: proyectoId,
      estado: 'Scheduled',
      umbral_horas_n1: 24,
      umbral_horas_n2: 48,
      umbral_horas_n3: 72,
      umbral_horas_n4: 96,
    }).select().single()

    expect(error).toBeNull()
    expect(data?.estado).toBe('Scheduled')
    expect(data?.nivel_escalacion).toBeNull()
  })

  it('workflow_estado tiene unique constraint por proceso_id (error 23505)', async () => {
    if (!hasCredenciales) return

    const { error } = await admin.from('workflow_estado').insert({
      proceso_id: procesoId,
      proyecto_id: proyectoId,
      estado: 'Scheduled',
    })
    expect(error).not.toBeNull()
    expect(error!.code).toBe('23505')
  })

  // ── riesgo ───────────────────────────────────────────────────

  it('se puede crear un riesgo con nivel_riesgo calculado manualmente (route handler lo calcula en app)', async () => {
    if (!hasCredenciales) return

    // En la app el route handler calcula nivel_riesgo antes del insert.
    // En este test insertamos directo a BD fijando nivel_riesgo: 'critico'.
    const { data, error } = await admin.from('riesgo').insert({
      proyecto_id: proyectoId,
      descripcion: 'Riesgo de test: rotación de equipo',
      probabilidad: 'alta',
      impacto: 'alto',
      nivel_riesgo: 'critico',
    }).select().single()

    expect(error).toBeNull()
    expect(data?.nivel_riesgo).toBe('critico')
    expect(data?.estado).toBe('activo')
  })

  // ── reunion ───────────────────────────────────────────────────

  it('se puede registrar una reunión con compromisos JSONB', async () => {
    if (!hasCredenciales) return

    const compromisos = [
      { descripcion: 'Enviar acta', responsable: 'Ana López', fecha_limite: '2026-07-01', completado: false },
    ]

    const { data, error } = await admin.from('reunion').insert({
      proyecto_id: proyectoId,
      titulo: 'Kick-off test',
      fecha: new Date().toISOString(),
      participantes: ['Ana López', 'Juan Pérez'],
      compromisos,
    }).select().single()

    expect(error).toBeNull()
    expect(data?.compromisos).toHaveLength(1)
    expect(data?.participantes).toContain('Ana López')
  })

  // ── kpi ───────────────────────────────────────────────────────

  it('se puede crear un KPI (linea_base y meta como text) y actualizar valor_actual', async () => {
    if (!hasCredenciales) return

    const { data: kpi, error: e1 } = await admin.from('kpi').insert({
      proyecto_id: proyectoId,
      nombre: 'Tiempo de ciclo',
      linea_base: '15',      // TEXT en BD
      meta: '8',             // TEXT en BD
      frecuencia: 'mensual',
    }).select().single()

    expect(e1).toBeNull()
    expect(kpi?.historico).toEqual([])
    expect(kpi?.linea_base).toBe('15')
    expect(kpi?.meta).toBe('8')

    const { data: updated, error: e2 } = await admin.from('kpi').update({
      valor_actual: '12',
      historico: [{ fecha: new Date().toISOString(), valor: '12' }],
    }).eq('id', kpi!.id).select().single()

    expect(e2).toBeNull()
    expect(updated?.valor_actual).toBe('12')
    expect(updated?.historico).toHaveLength(1)
  })
})

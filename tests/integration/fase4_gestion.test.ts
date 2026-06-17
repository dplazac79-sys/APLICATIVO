/**
 * Tests de integración — Fase 4: Gestión de Proyecto
 * Run: npm run test:integration
 * Requiere: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY en .env.local
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
      pais: 'CL',
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
      tipo: 'operativo',
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

  it('TRANSICIONES_VALIDAS cubre los 7 estados', () => {
    const estados: WorkflowEstadoTipo[] = [
      'Scheduled', 'Assigned', 'In Progress',
      'Pending Approval', 'Approved', 'Implemented', 'Closed',
    ]
    for (const estado of estados) {
      expect(TRANSICIONES_VALIDAS[estado]).toBeDefined()
    }
  })

  it('transición Scheduled → Assigned es válida, Scheduled → Approved no', () => {
    expect(TRANSICIONES_VALIDAS['Scheduled']).toContain('Assigned')
    expect(TRANSICIONES_VALIDAS['Scheduled']).not.toContain('Approved')
  })

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

  it('workflow_estado tiene unique constraint por proceso_id', async () => {
    if (!hasCredenciales) return

    const { error } = await admin.from('workflow_estado').insert({
      proceso_id: procesoId,
      proyecto_id: proyectoId,
      estado: 'Scheduled',
    })
    expect(error).not.toBeNull()
    expect(error!.code).toBe('23505')
  })

  it('se puede crear un riesgo y calcular nivel_riesgo automáticamente', async () => {
    if (!hasCredenciales) return

    const { data, error } = await admin.from('riesgo').insert({
      proyecto_id: proyectoId,
      descripcion: 'Riesgo de test: rotación de equipo',
      probabilidad: 'alta',
      impacto: 'alto',
    }).select().single()

    expect(error).toBeNull()
    expect(data?.nivel_riesgo).toBe('critico')
    expect(data?.estado).toBe('activo')
  })

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

  it('se puede crear un KPI y actualizar valor_actual con historico', async () => {
    if (!hasCredenciales) return

    const { data: kpi, error: e1 } = await admin.from('kpi').insert({
      proyecto_id: proyectoId,
      nombre: 'Tiempo de ciclo',
      unidad: 'días',
      linea_base: 15,
      meta: 8,
      frecuencia_medicion: 'mensual',
    }).select().single()

    expect(e1).toBeNull()
    expect(kpi?.historico).toEqual([])

    const { data: updated, error: e2 } = await admin.from('kpi').update({
      valor_actual: 12,
      historico: [{ fecha: new Date().toISOString(), valor: 12 }],
    }).eq('id', kpi!.id).select().single()

    expect(e2).toBeNull()
    expect(updated?.valor_actual).toBe(12)
    expect(updated?.historico).toHaveLength(1)
  })
})

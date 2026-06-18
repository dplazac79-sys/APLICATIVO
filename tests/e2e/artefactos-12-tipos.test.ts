/**
 * Test E2E: Los 12 tipos de artefacto — DoD Fase 3
 *
 * Verifica que cada tipo puede:
 * 1. Crearse en BD con contenido válido
 * 2. Transicionar pendiente → validado → publicado
 * 3. Su prompt file existe y tiene contenido
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TIPOS_ARTEFACTO = [
  'as_is',
  'to_be',
  'sipoc',
  'bpmn',
  'historias_usuario',
  'flujograma',
  'raci',
  'riesgo_control',
  'kpi_sla',
  'diagnostico',
  'dashboard_brechas',
  'cierre_ejecutivo',
] as const

const PROMPTS_DIR = join(process.cwd(), 'src/lib/prompts/artefactos')
const TEST_TAG = 'e2e-artefactos-' + Date.now()

let clienteId: string
let proyectoId: string
let procesoId: string
const artefactoIds: string[] = []

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

  const { data: pr } = await admin.from('proceso').insert({
    proyecto_id: proyectoId,
    nombre: `Proceso E2E ${TEST_TAG}`,
    tipo: 'proceso',
    nivel: 1,
    origen: 'manual',
    estado_oferta: 'aceptado',
  }).select().single()
  procesoId = pr!.id
})

afterAll(async () => {
  for (const id of artefactoIds) {
    await admin.from('artefacto').delete().eq('id', id)
  }
  await admin.from('proceso').delete().eq('id', procesoId)
  await admin.from('proyecto').delete().eq('id', proyectoId)
  await admin.from('cliente').delete().eq('id', clienteId)
})

describe('12 tipos de artefacto — creación, validación y prompt', () => {

  TIPOS_ARTEFACTO.forEach(tipo => {
    describe(`tipo: ${tipo}`, () => {

      it('prompt file existe y tiene contenido', () => {
        const path = join(PROMPTS_DIR, `${tipo}.md`)
        expect(existsSync(path), `Falta ${tipo}.md en lib/prompts/artefactos/`).toBe(true)
        const content = readFileSync(path, 'utf-8')
        expect(content.length).toBeGreaterThan(100)
      })

      it('se crea en BD con estado pendiente', async () => {
        const { data, error } = await admin.from('artefacto').insert({
          proceso_id: procesoId,
          proyecto_id: proyectoId,
          tipo,
          estado_validacion: 'pendiente',
          contenido: {
            generado_por: 'test-e2e',
            tipo_test: tipo,
            descripcion: `Contenido de prueba para artefacto ${tipo}`,
          },
        }).select().single()

        expect(error).toBeNull()
        expect(data!.tipo).toBe(tipo)
        expect(data!.estado_validacion).toBe('pendiente')
        artefactoIds.push(data!.id)
      })

      it('transiciona pendiente → validado → publicado', async () => {
        const id = artefactoIds.find((_, i) => {
          return artefactoIds.length > 0
        })
        const artefactoId = artefactoIds[artefactoIds.length - 1]

        const { error: e1 } = await admin.from('artefacto')
          .update({ estado_validacion: 'validado' })
          .eq('id', artefactoId)
          .eq('tipo', tipo)
        expect(e1).toBeNull()

        const { error: e2 } = await admin.from('artefacto')
          .update({ estado_validacion: 'publicado' })
          .eq('id', artefactoId)
          .eq('tipo', tipo)
        expect(e2).toBeNull()

        const { data } = await admin.from('artefacto')
          .select('estado_validacion')
          .eq('id', artefactoId)
          .single()
        expect(data!.estado_validacion).toBe('publicado')
      })

    })
  })

  it('los 12 tipos están cubiertos — ningún tipo falta', () => {
    expect(TIPOS_ARTEFACTO).toHaveLength(12)
  })

  it('se crearon exactamente 12 artefactos en BD', async () => {
    const { count } = await admin
      .from('artefacto')
      .select('*', { count: 'exact', head: true })
      .in('id', artefactoIds)
    expect(count).toBe(12)
  })

  it('los 12 artefactos quedaron en estado publicado', async () => {
    const { data } = await admin
      .from('artefacto')
      .select('tipo, estado_validacion')
      .in('id', artefactoIds)
    const todos = data ?? []
    expect(todos).toHaveLength(12)
    todos.forEach(a => {
      expect(a.estado_validacion, `${a.tipo} no está publicado`).toBe('publicado')
    })
  })

})

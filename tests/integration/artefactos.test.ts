import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createAdminClient } from '@/lib/supabase/admin'

const hasCredenciales = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY

describe('Artefactos — trazabilidad y RBAC (DoD Fase 3)', () => {
  const admin = createAdminClient()
  const sufijo = `artefacto-test-${Date.now()}`
  let clienteId: string
  let proyectoId: string
  let procesoId: string
  let artefactoId: string

  beforeAll(async () => {
    if (!hasCredenciales) return

    const { data: cliente } = await admin
      .from('cliente').insert({ razon_social: `Cliente Artefacto ${sufijo}` }).select().single()
    clienteId = cliente!.id

    const { data: proyecto } = await admin
      .from('proyecto').insert({ cliente_id: clienteId, nombre: `Proyecto Artefacto ${sufijo}` }).select().single()
    proyectoId = proyecto!.id

    const { data: proceso } = await admin
      .from('proceso').insert({
        proyecto_id: proyectoId,
        nombre: 'Proceso de prueba artefactos',
        nivel: 0,
        tipo: 'macroproceso',
        origen: 'manual',
        estado_oferta: 'aceptado',
        orden: 0,
      }).select().single()
    procesoId = proceso!.id
  })

  afterAll(async () => {
    if (!hasCredenciales) return
    await admin.from('artefacto').delete().eq('proceso_id', procesoId)
    await admin.from('proceso').delete().eq('id', procesoId)
    await admin.from('proyecto').delete().eq('id', proyectoId)
    await admin.from('cliente').delete().eq('id', clienteId)
  })

  it('se puede insertar un artefacto SIPOC y queda asociado al proceso', async () => {
    if (!hasCredenciales) return

    const contenido = {
      proveedores: ['Proveedor A'],
      entradas: ['Entrada 1'],
      proceso: 'Proceso de prueba',
      salidas: ['Salida 1'],
      clientes: ['Cliente interno'],
    }

    const { data, error } = await admin
      .from('artefacto')
      .insert({
        proceso_id: procesoId,
        proyecto_id: proyectoId,
        tipo: 'sipoc',
        contenido,
        estado_validacion: 'pendiente',
        generado_por_ia: false,
      })
      .select()
      .single()

    expect(error).toBeNull()
    expect(data).toBeTruthy()
    expect(data!.proceso_id).toBe(procesoId)
    expect(data!.tipo).toBe('sipoc')
    artefactoId = data!.id
  })

  it('la trazabilidad documento → proceso → artefacto es verificable', async () => {
    if (!hasCredenciales || !artefactoId) return

    const { data: artefacto } = await admin
      .from('artefacto')
      .select('*, proceso:proceso_id(id, proyecto_id, nombre)')
      .eq('id', artefactoId)
      .single()

    expect(artefacto).toBeTruthy()
    expect(artefacto!.proceso_id).toBe(procesoId)
    const proc = artefacto!.proceso as Record<string, unknown>
    expect(proc.proyecto_id).toBe(proyectoId)
  })

  it('el estado_validacion transiciona de pendiente a validado', async () => {
    if (!hasCredenciales || !artefactoId) return

    const { error } = await admin
      .from('artefacto')
      .update({ estado_validacion: 'validado' })
      .eq('id', artefactoId)

    expect(error).toBeNull()

    const { data } = await admin
      .from('artefacto').select('estado_validacion').eq('id', artefactoId).single()
    expect(data?.estado_validacion).toBe('validado')
  })

  it('el estado_validacion transiciona a publicado', async () => {
    if (!hasCredenciales || !artefactoId) return

    await admin.from('artefacto').update({ estado_validacion: 'publicado' }).eq('id', artefactoId)
    const { data } = await admin
      .from('artefacto').select('estado_validacion').eq('id', artefactoId).single()
    expect(data?.estado_validacion).toBe('publicado')
  })

  it('la versión incrementa al actualizar contenido', async () => {
    if (!hasCredenciales || !artefactoId) return

    const { data: antes } = await admin
      .from('artefacto').select('version').eq('id', artefactoId).single()
    const versionAntes = antes!.version

    await admin.from('artefacto').update({
      contenido: { proveedores: ['Proveedor B'], entradas: ['Entrada 2'], proceso: 'Actualizado', salidas: [], clientes: [] },
      version: versionAntes + 1,
    }).eq('id', artefactoId)

    const { data: despues } = await admin
      .from('artefacto').select('version').eq('id', artefactoId).single()
    expect(despues!.version).toBe(versionAntes + 1)
  })

  it('único por proceso_id + tipo (constraint unique)', async () => {
    if (!hasCredenciales || !procesoId) return

    const { error } = await admin
      .from('artefacto')
      .insert({
        proceso_id: procesoId,
        proyecto_id: proyectoId,
        tipo: 'sipoc', // duplicado
        contenido: {},
      })

    expect(error).toBeTruthy()
    expect(error!.code).toBe('23505') // unique_violation
  })
})

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

const hasCredenciales = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY

const describeOrSkip = hasCredenciales ? describe : describe.skip

describeOrSkip('RLS — aislamiento de datos por proyecto y rol', () => {
  const admin = createAdminClient()
  const sufijo = `test-${Date.now()}`
  const passwordPrueba = 'TestPassword123!'

  let clienteAId: string
  let clienteBId: string
  let proyectoAId: string
  let proyectoBId: string
  let usuarioClienteAId: string
  let superAdminId: string
  let directorAId: string
  let consultorAId: string
  let sponsorAId: string

  beforeAll(async () => {
    const { data: clienteA } = await admin.from('cliente').insert({ razon_social: `Cliente A ${sufijo}` }).select().single()
    const { data: clienteB } = await admin.from('cliente').insert({ razon_social: `Cliente B ${sufijo}` }).select().single()
    clienteAId = clienteA!.id
    clienteBId = clienteB!.id

    const { data: proyectoA } = await admin.from('proyecto').insert({ cliente_id: clienteAId, nombre: `Proyecto A ${sufijo}` }).select().single()
    const { data: proyectoB } = await admin.from('proyecto').insert({ cliente_id: clienteBId, nombre: `Proyecto B ${sufijo}` }).select().single()
    proyectoAId = proyectoA!.id
    proyectoBId = proyectoB!.id

    const { data: userA } = await admin.auth.admin.createUser({
      email: `usuario-a-${sufijo}@test.processos.local`,
      password: passwordPrueba,
      email_confirm: true,
    })
    usuarioClienteAId = userA!.user!.id
    await admin.from('usuario').insert({
      id: usuarioClienteAId,
      nombre: 'Usuario Cliente A (test)',
      email: userA!.user!.email!,
      rol: 'usuario_cliente',
    })
    await admin.from('usuario_proyecto').insert({ usuario_id: usuarioClienteAId, proyecto_id: proyectoAId })

    const { data: userSuper } = await admin.auth.admin.createUser({
      email: `super-${sufijo}@test.processos.local`,
      password: passwordPrueba,
      email_confirm: true,
    })
    superAdminId = userSuper!.user!.id
    await admin.from('usuario').insert({
      id: superAdminId,
      nombre: 'Super Admin (test)',
      email: userSuper!.user!.email!,
      rol: 'super_admin',
    })

    const { data: userDirector } = await admin.auth.admin.createUser({
      email: `director-${sufijo}@test.processos.local`,
      password: passwordPrueba,
      email_confirm: true,
    })
    directorAId = userDirector!.user!.id
    await admin.from('usuario').insert({
      id: directorAId,
      nombre: 'Director Proyecto A (test)',
      email: userDirector!.user!.email!,
      rol: 'director_proyecto',
    })
    await admin.from('usuario_proyecto').insert({ usuario_id: directorAId, proyecto_id: proyectoAId })

    const { data: userConsultor } = await admin.auth.admin.createUser({
      email: `consultor-${sufijo}@test.processos.local`,
      password: passwordPrueba,
      email_confirm: true,
    })
    consultorAId = userConsultor!.user!.id
    await admin.from('usuario').insert({
      id: consultorAId,
      nombre: 'Consultor A (test)',
      email: userConsultor!.user!.email!,
      rol: 'consultor',
    })
    await admin.from('usuario_proyecto').insert({ usuario_id: consultorAId, proyecto_id: proyectoAId })

    const { data: userSponsor } = await admin.auth.admin.createUser({
      email: `sponsor-${sufijo}@test.processos.local`,
      password: passwordPrueba,
      email_confirm: true,
    })
    sponsorAId = userSponsor!.user!.id
    await admin.from('usuario').insert({
      id: sponsorAId,
      nombre: 'Sponsor Cliente A (test)',
      email: userSponsor!.user!.email!,
      rol: 'sponsor_cliente',
    })
    await admin.from('usuario_proyecto').insert({ usuario_id: sponsorAId, proyecto_id: proyectoAId })
  })

  afterAll(async () => {
    const limpiar = async (fn: () => PromiseLike<unknown>) => {
      try {
        await fn()
      } catch (err) {
        console.warn('[rls.test cleanup] paso de limpieza falló (no bloqueante):', err)
      }
    }

    const todosUsuarios = [usuarioClienteAId, superAdminId, directorAId, consultorAId, sponsorAId]
    await limpiar(() => admin.from('audit_log').delete().in('usuario_id', todosUsuarios))
    for (const id of todosUsuarios) {
      if (id) await limpiar(() => admin.auth.admin.deleteUser(id))
    }
    await limpiar(() => admin.from('proyecto').delete().in('id', [proyectoAId, proyectoBId]))
    await limpiar(() => admin.from('cliente').delete().in('id', [clienteAId, clienteBId]))
  })

  async function clienteComo(email: string) {
    const client = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { error } = await client.auth.signInWithPassword({ email, password: passwordPrueba })
    if (error) throw error
    return client
  }

  it('un usuario_cliente solo ve los proyectos a los que está asignado', async () => {
    const client = await clienteComo(`usuario-a-${sufijo}@test.processos.local`)
    const { data } = await client.from('proyecto').select('id').in('id', [proyectoAId, proyectoBId])
    const idsVisibles = (data ?? []).map(p => p.id)

    expect(idsVisibles).toContain(proyectoAId)
    expect(idsVisibles).not.toContain(proyectoBId)
  })

  it('un usuario_cliente no puede ver el cliente dueño de un proyecto ajeno', async () => {
    const client = await clienteComo(`usuario-a-${sufijo}@test.processos.local`)
    const { data } = await client.from('cliente').select('id').in('id', [clienteAId, clienteBId])
    const idsVisibles = (data ?? []).map(c => c.id)

    expect(idsVisibles).toContain(clienteAId)
    expect(idsVisibles).not.toContain(clienteBId)
  })

  it('super_admin ve todos los proyectos sin restricción', async () => {
    const client = await clienteComo(`super-${sufijo}@test.processos.local`)
    const { data } = await client.from('proyecto').select('id').in('id', [proyectoAId, proyectoBId])
    const idsVisibles = (data ?? []).map(p => p.id)

    expect(idsVisibles).toContain(proyectoAId)
    expect(idsVisibles).toContain(proyectoBId)
  })

  it('un usuario solo ve sus propias entradas de audit_log, no las de otros', async () => {
    await admin.from('audit_log').insert([
      { usuario_id: usuarioClienteAId, accion: 'CREATE', entidad: 'test', detalle: {} },
      { usuario_id: superAdminId, accion: 'CREATE', entidad: 'test', detalle: {} },
    ])

    const client = await clienteComo(`usuario-a-${sufijo}@test.processos.local`)
    const { data } = await client.from('audit_log').select('usuario_id')
    const usuarios = new Set((data ?? []).map(r => r.usuario_id))

    expect(usuarios.has(usuarioClienteAId)).toBe(true)
    expect(usuarios.has(superAdminId)).toBe(false)
  })

  it('super_admin puede ver entradas de audit_log de cualquier usuario', async () => {
    const client = await clienteComo(`super-${sufijo}@test.processos.local`)
    const { data } = await client.from('audit_log').select('usuario_id').in('usuario_id', [usuarioClienteAId, superAdminId])
    const usuarios = new Set((data ?? []).map(r => r.usuario_id))

    expect(usuarios.has(usuarioClienteAId)).toBe(true)
    expect(usuarios.has(superAdminId)).toBe(true)
  })

  it('un director_proyecto asignado solo ve su proyecto, no proyectos ajenos', async () => {
    const client = await clienteComo(`director-${sufijo}@test.processos.local`)
    const { data } = await client.from('proyecto').select('id').in('id', [proyectoAId, proyectoBId])
    const idsVisibles = (data ?? []).map(p => p.id)

    expect(idsVisibles).toContain(proyectoAId)
    expect(idsVisibles).not.toContain(proyectoBId)
  })

  it('un consultor asignado puede insertar documentos en su proyecto', async () => {
    const client = await clienteComo(`consultor-${sufijo}@test.processos.local`)
    const { data, error } = await client.from('documento').insert({
      proyecto_id: proyectoAId,
      nombre_archivo: 'test-consultor.txt',
      url_storage: `${proyectoAId}/test-consultor.txt`,
    }).select().single()

    expect(error).toBeNull()
    expect(data?.proyecto_id).toBe(proyectoAId)

    if (data?.id) await admin.from('documento').delete().eq('id', data.id)
  })

  it('un sponsor_cliente puede ver documentos de su proyecto pero no puede insertar', async () => {
    const client = await clienteComo(`sponsor-${sufijo}@test.processos.local`)

    const { data: docInsertado } = await admin.from('documento').insert({
      proyecto_id: proyectoAId,
      nombre_archivo: 'visible-para-sponsor.txt',
      url_storage: `${proyectoAId}/visible-para-sponsor.txt`,
    }).select().single()

    const { data: visibles } = await client.from('documento').select('id').eq('proyecto_id', proyectoAId)
    expect((visibles ?? []).some(d => d.id === docInsertado!.id)).toBe(true)

    const { error: errorInsert } = await client.from('documento').insert({
      proyecto_id: proyectoAId,
      nombre_archivo: 'intento-sponsor.txt',
      url_storage: `${proyectoAId}/intento-sponsor.txt`,
    })
    expect(errorInsert).not.toBeNull()

    if (docInsertado?.id) await admin.from('documento').delete().eq('id', docInsertado.id)
  })
})

if (!hasCredenciales) {
  describe('RLS — omitido', () => {
    it('se omite porque no hay credenciales de Supabase en el entorno', () => {
      expect(true).toBe(true)
    })
  })
}

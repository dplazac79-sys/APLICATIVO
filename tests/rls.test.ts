/**
 * Tests de RLS (Row Level Security)
 * Verifican que un usuario de cliente A no pueda ver datos de cliente B
 *
 * Requiere: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local
 * Ejecución: npx tsx tests/rls.test.ts
 */

import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { realtime: { transport: ws } })

let passed = 0
let failed = 0

function ok(label: string, condition: boolean) {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.error(`  ❌ FALLO: ${label}`)
    failed++
  }
}

async function cleanup(ids: { clienteA?: string; clienteB?: string; userA?: string; userB?: string }) {
  if (ids.userA) {
    await admin.from('usuario').delete().eq('id', ids.userA)
    await admin.auth.admin.deleteUser(ids.userA).catch(() => null)
  }
  if (ids.userB) {
    await admin.from('usuario').delete().eq('id', ids.userB)
    await admin.auth.admin.deleteUser(ids.userB).catch(() => null)
  }
  if (ids.clienteA) {
    await admin.from('proyecto').delete().eq('cliente_id', ids.clienteA)
    await admin.from('cliente').delete().eq('id', ids.clienteA)
  }
  if (ids.clienteB) {
    await admin.from('proyecto').delete().eq('cliente_id', ids.clienteB)
    await admin.from('cliente').delete().eq('id', ids.clienteB)
  }
}

async function runTests() {
  console.log('\n🔐 Tests de RLS — Aislamiento entre clientes\n')

  const ids: { clienteA?: string; clienteB?: string; userA?: string; userB?: string } = {}

  try {
    // 1. Crear dos clientes distintos
    const { data: clienteA } = await admin.from('cliente').insert({
      razon_social: '__TEST_Cliente_A__',
      industria: 'test',
      tamano: 'pequeña',
      activo: true,
    }).select().single()

    const { data: clienteB } = await admin.from('cliente').insert({
      razon_social: '__TEST_Cliente_B__',
      industria: 'test',
      tamano: 'pequeña',
      activo: true,
    }).select().single()

    ids.clienteA = clienteA!.id
    ids.clienteB = clienteB!.id

    // 2. Crear proyecto para cada cliente
    const { data: proyectoA } = await admin.from('proyecto').insert({
      nombre: '__TEST_Proyecto_A__',
      cliente_id: clienteA!.id,
      estado_general: 'activo',
    }).select().single()

    const { data: proyectoB } = await admin.from('proyecto').insert({
      nombre: '__TEST_Proyecto_B__',
      cliente_id: clienteB!.id,
      estado_general: 'activo',
    }).select().single()

    // 3. Crear usuarios de prueba para cada cliente
    const emailA = `rls_test_a_${Date.now()}@test.apac.cl`
    const emailB = `rls_test_b_${Date.now()}@test.apac.cl`
    const password = 'TestRLS2026!!'

    const { data: authA } = await admin.auth.admin.createUser({
      email: emailA, password, email_confirm: true,
    })
    const { data: authB } = await admin.auth.admin.createUser({
      email: emailB, password, email_confirm: true,
    })

    ids.userA = authA.user!.id
    ids.userB = authB.user!.id

    await admin.from('usuario').upsert({ id: ids.userA, email: emailA, nombre: 'Test A', rol: 'sponsor_cliente', activo: true })
    await admin.from('usuario').upsert({ id: ids.userB, email: emailB, nombre: 'Test B', rol: 'sponsor_cliente', activo: true })

    // 4. Asignar usuario A solo al proyecto A, usuario B solo al proyecto B
    await admin.from('usuario_proyecto').insert({ usuario_id: ids.userA, proyecto_id: proyectoA!.id })
    await admin.from('usuario_proyecto').insert({ usuario_id: ids.userB, proyecto_id: proyectoB!.id })

    // 5. Login como usuario A con client anon
    const clientA = createClient(SUPABASE_URL, ANON_KEY, { realtime: { transport: ws } })
    const { error: loginErrA } = await clientA.auth.signInWithPassword({ email: emailA, password })
    ok('Usuario A puede autenticarse', !loginErrA)

    // 6. Usuario A lee sus propios proyectos
    const { data: proyectosA } = await clientA.from('proyecto').select('id, nombre')
    const veProyectoA = proyectosA?.some(p => p.nombre === '__TEST_Proyecto_A__')
    const veProyectoB = proyectosA?.some(p => p.nombre === '__TEST_Proyecto_B__')
    ok('Usuario A ve su propio proyecto', !!veProyectoA)
    ok('Usuario A NO ve el proyecto de Cliente B', !veProyectoB)

    // 7. Login como usuario B
    const clientB = createClient(SUPABASE_URL, ANON_KEY, { realtime: { transport: ws } })
    await clientB.auth.signInWithPassword({ email: emailB, password })

    const { data: proyectosB } = await clientB.from('proyecto').select('id, nombre')
    const veProyectoASinAutorizar = proyectosB?.some(p => p.nombre === '__TEST_Proyecto_A__')
    const veProyectoBPropio = proyectosB?.some(p => p.nombre === '__TEST_Proyecto_B__')
    ok('Usuario B ve su propio proyecto', !!veProyectoBPropio)
    ok('Usuario B NO ve el proyecto de Cliente A', !veProyectoASinAutorizar)

    // 8. Usuario A intenta leer clientes directamente
    const { data: clientesVisiblesA } = await clientA.from('cliente').select('id, razon_social')
    const veClienteB = clientesVisiblesA?.some(c => c.razon_social === '__TEST_Cliente_B__')
    ok('Usuario A NO ve datos del Cliente B en tabla cliente', !veClienteB)

  } catch (err) {
    console.error('Error inesperado en tests:', err)
    failed++
  } finally {
    await cleanup(ids)
    console.log(`\n📊 Resultado: ${passed} pasaron, ${failed} fallaron`)
    if (failed > 0) {
      console.error('\n⚠️  HAY FALLOS DE RLS — revisar políticas de seguridad antes de comercializar\n')
      process.exit(1)
    } else {
      console.log('\n🎉 Todos los tests de RLS pasaron — aislamiento entre clientes verificado\n')
    }
  }
}

runTests()

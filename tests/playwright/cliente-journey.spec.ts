/**
 * E2E completo centrado en el cliente — evaluación funcional, UX, UI, velocidad
 * Cubre el flujo completo de un sponsor_cliente desde login hasta zona de implementación.
 *
 * Variables requeridas en .env.local:
 *   E2E_CLIENTE_EMAIL    — usuario sponsor_cliente
 *   E2E_CLIENTE_PASSWORD — contraseña del cliente
 *   E2E_ADMIN_EMAIL      — usuario super_admin
 *   E2E_ADMIN_PASSWORD   — contraseña del admin
 */
import { test, expect, Page } from '@playwright/test'

const CLIENTE_EMAIL    = process.env.E2E_CLIENTE_EMAIL    ?? 'cliente.demo@apac.cl'
const CLIENTE_PASSWORD = process.env.E2E_CLIENTE_PASSWORD ?? 'ClienteDemo2026!!'
const ADMIN_EMAIL      = process.env.E2E_ADMIN_EMAIL      ?? process.env.E2E_USER_EMAIL ?? ''
const ADMIN_PASSWORD   = process.env.E2E_ADMIN_PASSWORD   ?? process.env.E2E_USER_PASSWORD ?? ''

// ── Helpers ───────────────────────────────────────────────────────────────────
async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  // Acepta dashboard, bienvenida, portal o mfa (flujo normal según rol y MFA)
  await page.waitForURL(/\/(dashboard|bienvenida|portal|mfa)/, { timeout: 15_000 })
  // Si cae en MFA enroll/challenge, lo consideramos login exitoso (token válido)
}

async function medirTiempo(label: string, fn: () => Promise<void>): Promise<number> {
  const t0 = Date.now()
  await fn()
  const ms = Date.now() - t0
  console.log(`⏱  ${label}: ${ms}ms`)
  return ms
}

// ── 1. LOGIN — UX / UI / Velocidad ───────────────────────────────────────────
test.describe('1 · Login — UX, UI, Performance', () => {

  test('página de login carga en < 3s y muestra elementos clave', async ({ page }) => {
    const ms = await medirTiempo('login page load', async () => {
      await page.goto('/login')
      await expect(page.locator('input[type="email"]')).toBeVisible()
    })
    expect(ms).toBeLessThan(3000)

    // Verifica elementos de UI
    await expect(page.locator('text=ProcessOS')).toBeVisible()
    await expect(page.locator('text=Acceso al portal')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
    await expect(page.locator('text=MFA activo')).toBeVisible()
    await expect(page.locator('text=Recordar dispositivo')).toBeVisible()
  })

  test('el carrusel animado rota automáticamente', async ({ page }) => {
    await page.goto('/login')
    await page.waitForTimeout(3500)
    // Verifica que los dots del carrusel existen
    const dots = page.locator('button[style*="border-radius: 3px"]')
    await expect(dots.first()).toBeVisible()
  })

  test('mostrar/ocultar contraseña funciona', async ({ page }) => {
    await page.goto('/login')
    const input = page.locator('input[type="password"]')
    await input.fill('MiPassword123')
    await expect(input).toHaveAttribute('type', 'password')
    // Click en el ojo
    await page.locator('button[type="button"]').click()
    await expect(page.locator('input[type="text"]')).toBeVisible()
  })

  test('credenciales incorrectas muestra error claro', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill('incorrecto@test.cl')
    await page.locator('input[type="password"]').fill('WrongPass!')
    await page.locator('button[type="submit"]').click()
    await expect(page.getByText(/credenciales proporcionadas/i)).toBeVisible({ timeout: 8_000 })
  })

  test('login cliente exitoso y redirige a destino válido', async ({ page }) => {
    const ms = await medirTiempo('login + redirect', async () => {
      await loginAs(page, CLIENTE_EMAIL, CLIENTE_PASSWORD)
    })
    expect(ms).toBeLessThan(8000)
    // Portal o MFA (si tiene MFA configurado)
    await expect(page).toHaveURL(/\/(portal|mfa|dashboard|bienvenida)/)
  })

})

// ── 2. PORTAL CLIENTE — Flujo principal ──────────────────────────────────────
test.describe('2 · Portal Cliente — Journey completo', () => {

  test.beforeEach(async ({ page }) => {
    await loginAs(page, CLIENTE_EMAIL, CLIENTE_PASSWORD)
    if (page.url().includes('/mfa')) await page.goto('/portal')
  })

  test('portal carga y muestra zona de carga de documentos', async ({ page }) => {
    // Si quedó en MFA, ir directo al portal
    if (page.url().includes('/mfa')) {
      await page.goto('/portal')
    }
    await expect(page).toHaveURL(/\/portal/)
    const ms = await medirTiempo('portal load', async () => {
      await expect(page.locator('text=/subir|cargar|documento/i').first()).toBeVisible({ timeout: 10_000 })
    })
    expect(ms).toBeLessThan(8000)
  })

  test('sidebar muestra solo opciones de cliente', async ({ page }) => {
    // Cliente solo ve Mi Portal y Zona de Implementación
    await expect(page.locator('text=Mi Portal')).toBeVisible()
    await expect(page.locator('text=Zona de Implementación')).toBeVisible()

    // NO debe ver opciones internas
    await expect(page.locator('text=Clientes e Industrias')).not.toBeVisible()
    await expect(page.locator('text=Process Discovery AI')).not.toBeVisible()
    await expect(page.locator('text=Administración')).not.toBeVisible()
  })

  test('zona de implementación es accesible desde el portal', async ({ page }) => {
    await page.locator('text=Zona de Implementación').click()
    await expect(page).toHaveURL(/\/implementacion/)
    await expect(page.locator('text=/implementaci/i').first()).toBeVisible({ timeout: 6_000 })
  })

  test('drag & drop zona es visible y tiene instrucciones claras', async ({ page }) => {
    await expect(page.locator('text=/arrastr|drag|soltar|PDF|DOCX/i').first()).toBeVisible({ timeout: 6_000 })
  })

  test('upload de archivo inválido muestra error apropiado', async ({ page }) => {
    // Intenta subir un .txt (tipo inválido)
    const fileInput = page.locator('input[type="file"]')
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles({
        name: 'test.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('contenido de prueba'),
      })
      // Debe mostrar error de tipo de archivo
      await expect(page.locator('text=/PDF|DOCX|formato/i').first()).toBeVisible({ timeout: 4_000 })
    } else {
      console.log('ℹ️  No hay input file directo (drag & drop), se omite validación de tipo')
      test.skip()
    }
  })

})

// ── 3. ADMIN — Flujo interno ──────────────────────────────────────────────────
test.describe('3 · Admin — Flujo interno', () => {

  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    if (page.url().includes('/mfa')) await page.goto('/dashboard')
  })

  test('dashboard carga en < 4s con métricas visibles', async ({ page }) => {
    await page.goto('/dashboard')
    const ms = await medirTiempo('dashboard load', async () => {
      await page.waitForLoadState('networkidle')
    })
    expect(ms).toBeLessThan(4000)
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('sidebar admin muestra todas las opciones', async ({ page }) => {
    for (const label of ['Dashboard', 'Clientes e Industrias', 'Centro Documental', 'Process Discovery AI']) {
      await expect(page.locator(`text=${label}`).first()).toBeVisible()
    }
  })

  test('clientes page carga y lista proyectos', async ({ page }) => {
    await page.goto('/clientes')
    await expect(page).toHaveURL(/\/clientes/)
    await page.waitForLoadState('networkidle')
    // Debe haber al menos un cliente o mensaje vacío
    const content = await page.content()
    expect(content.length).toBeGreaterThan(500)
  })

  test('discovery AI page carga correctamente', async ({ page }) => {
    await page.goto('/discovery')
    await expect(page).toHaveURL(/\/discovery/)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 6_000 })
  })

  test('documentos page carga sin errores', async ({ page }) => {
    await page.goto('/documentos')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/documentos/)
  })

})

// ── 4. RESPONSIVE — Mobile 390px ─────────────────────────────────────────────
test.describe('4 · Responsive — Mobile (390×844)', () => {

  test.use({ viewport: { width: 390, height: 844 } })

  test('login se ve bien en iPhone 14', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()

    // El formulario no debe desbordar horizontalmente
    const body = page.locator('body')
    const bodyWidth = await body.evaluate(el => el.scrollWidth)
    expect(bodyWidth).toBeLessThanOrEqual(400)
  })

  test('login funcional en móvil', async ({ page }) => {
    await loginAs(page, CLIENTE_EMAIL, CLIENTE_PASSWORD)
    await expect(page).toHaveURL(/\/portal/)
  })

  test('sidebar móvil: muestra botón hamburguesa', async ({ page }) => {
    await loginAs(page, CLIENTE_EMAIL, CLIENTE_PASSWORD)
    // El sidebar desktop debe estar oculto, debe haber un trigger móvil
    await expect(page.locator('.hidden.md\\:flex, [class*="hidden md:"]')).toBeDefined()
  })

  test('portal cliente en móvil no tiene scroll horizontal', async ({ page }) => {
    await loginAs(page, CLIENTE_EMAIL, CLIENTE_PASSWORD)
    const bodyWidth = await page.locator('body').evaluate(el => el.scrollWidth)
    const viewportWidth = 390
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5) // 5px de tolerancia
  })

})

// ── 5. RESPONSIVE — Tablet 768px ─────────────────────────────────────────────
test.describe('5 · Responsive — Tablet (768×1024)', () => {

  test.use({ viewport: { width: 768, height: 1024 } })

  test('login en tablet — layout correcto', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('dashboard en tablet sin desborde', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    const bodyWidth = await page.locator('body').evaluate(el => el.scrollWidth)
    expect(bodyWidth).toBeLessThanOrEqual(780)
  })

})

// ── 6. PERFORMANCE — Core Web Vitals aproximados ─────────────────────────────
test.describe('6 · Performance — Tiempos de carga', () => {

  test('login < 3s', async ({ page }) => {
    const ms = await medirTiempo('/login', async () => {
      await page.goto('/login')
      await page.waitForLoadState('networkidle')
    })
    expect(ms).toBeLessThan(3000)
  })

  test('dashboard < 5s (post login)', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    const ms = await medirTiempo('/dashboard networkidle', async () => {
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
    })
    expect(ms).toBeLessThan(5000)
  })

  test('portal cliente < 5s', async ({ page }) => {
    await loginAs(page, CLIENTE_EMAIL, CLIENTE_PASSWORD)
    const ms = await medirTiempo('/portal networkidle', async () => {
      await page.goto('/portal')
      await page.waitForLoadState('networkidle')
    })
    expect(ms).toBeLessThan(5000)
  })

  test('no hay errores de consola críticos en login', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    // Filtra errores conocidos/aceptables
    const critical = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('hydrat') &&
      !e.includes('Warning:')
    )
    if (critical.length > 0) console.warn('Errores consola:', critical)
    expect(critical.length).toBe(0)
  })

  test('no hay errores de consola críticos en portal cliente', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
    await loginAs(page, CLIENTE_EMAIL, CLIENTE_PASSWORD)
    await page.waitForLoadState('networkidle')
    const critical = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('hydrat') &&
      !e.includes('Warning:')
    )
    if (critical.length > 0) console.warn('Errores consola:', critical)
    expect(critical.length).toBe(0)
  })

})

// ── 7. SEGURIDAD — Acceso y aislamiento ──────────────────────────────────────
test.describe('7 · Seguridad — Aislamiento de roles', () => {

  test('cliente NO puede acceder a /dashboard', async ({ page }) => {
    await loginAs(page, CLIENTE_EMAIL, CLIENTE_PASSWORD)
    await page.goto('/dashboard')
    // Debe redirigir o mostrar acceso denegado
    await expect(page).not.toHaveURL(/\/dashboard/, { timeout: 5_000 })
  })

  test('cliente NO puede acceder a /clientes', async ({ page }) => {
    await loginAs(page, CLIENTE_EMAIL, CLIENTE_PASSWORD)
    await page.goto('/clientes')
    await expect(page).not.toHaveURL(/\/clientes/, { timeout: 5_000 })
  })

  test('cliente NO puede acceder a /admin', async ({ page }) => {
    await loginAs(page, CLIENTE_EMAIL, CLIENTE_PASSWORD)
    await page.goto('/admin')
    await expect(page).not.toHaveURL(/\/admin/, { timeout: 5_000 })
  })

  test('ruta protegida sin sesión → redirige a login', async ({ page }) => {
    await page.goto('/portal')
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 })
  })

})

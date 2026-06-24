# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cliente-journey.spec.ts >> 5 · Responsive — Tablet (768×1024) >> dashboard en tablet sin desborde
- Location: tests/playwright/cliente-journey.spec.ts:249:7

# Error details

```
TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - img [ref=e5]
        - generic [ref=e17]:
          - generic [ref=e18]:
            - generic [ref=e19]: Process
            - generic [ref=e20]: OS
          - generic [ref=e21]: by AICOUNTS CONSULTORES
    - main [ref=e22]:
      - generic [ref=e24]:
        - generic [ref=e25]:
          - generic [ref=e27]:
            - heading "Acceso al portal" [level=2] [ref=e28]
            - paragraph [ref=e29]: Ingresa tus credenciales corporativas
          - generic [ref=e30]:
            - generic [ref=e31]:
              - generic [ref=e32]: Correo corporativo
              - generic [ref=e33]:
                - img [ref=e34]
                - textbox "nombre@empresa.com" [ref=e37]: dplazac79@gmail.com
            - generic [ref=e38]:
              - generic [ref=e39]:
                - generic [ref=e40]: Contraseña
                - link "¿Olvidaste?" [ref=e41] [cursor=pointer]:
                  - /url: "#"
              - generic [ref=e42]:
                - img [ref=e43]
                - textbox "••••••••••••" [active] [ref=e46]
                - button [ref=e47] [cursor=pointer]:
                  - img [ref=e48]
            - generic [ref=e51]:
              - generic [ref=e52] [cursor=pointer]:
                - checkbox "Recordar dispositivo" [ref=e53]
                - generic [ref=e54]: Recordar dispositivo
              - generic [ref=e55]:
                - img [ref=e56]
                - generic [ref=e58]: MFA activo
            - button "Ingresar al sistema" [ref=e59] [cursor=pointer]
        - paragraph [ref=e60]: Acceso auditado bajo RBAC · audit_log activo
    - contentinfo [ref=e61]:
      - generic [ref=e62]: © 2026 AICOUNTS CONSULTORES. Todos los derechos reservados.
      - generic [ref=e63]:
        - link "Privacidad" [ref=e64] [cursor=pointer]:
          - /url: "#"
        - link "EULA" [ref=e65] [cursor=pointer]:
          - /url: "#"
        - link "Soporte" [ref=e66] [cursor=pointer]:
          - /url: "#"
  - alert [ref=e67]
```

# Test source

```ts
  1   | /**
  2   |  * E2E completo centrado en el cliente — evaluación funcional, UX, UI, velocidad
  3   |  * Cubre el flujo completo de un sponsor_cliente desde login hasta zona de implementación.
  4   |  *
  5   |  * Variables requeridas en .env.local:
  6   |  *   E2E_CLIENTE_EMAIL    — usuario sponsor_cliente
  7   |  *   E2E_CLIENTE_PASSWORD — contraseña del cliente
  8   |  *   E2E_ADMIN_EMAIL      — usuario super_admin
  9   |  *   E2E_ADMIN_PASSWORD   — contraseña del admin
  10  |  */
  11  | import { test, expect, Page } from '@playwright/test'
  12  | 
  13  | const CLIENTE_EMAIL    = process.env.E2E_CLIENTE_EMAIL    ?? 'cliente.demo@apac.cl'
  14  | const CLIENTE_PASSWORD = process.env.E2E_CLIENTE_PASSWORD ?? 'ClienteDemo2026!!'
  15  | const ADMIN_EMAIL      = process.env.E2E_ADMIN_EMAIL      ?? process.env.E2E_USER_EMAIL ?? ''
  16  | const ADMIN_PASSWORD   = process.env.E2E_ADMIN_PASSWORD   ?? process.env.E2E_USER_PASSWORD ?? ''
  17  | 
  18  | // ── Helpers ───────────────────────────────────────────────────────────────────
  19  | async function loginAs(page: Page, email: string, password: string) {
  20  |   await page.goto('/login')
  21  |   await page.locator('input[type="email"]').fill(email)
  22  |   await page.locator('input[type="password"]').fill(password)
  23  |   await page.locator('button[type="submit"]').click()
  24  |   // Acepta dashboard, bienvenida, portal o mfa (flujo normal según rol y MFA)
> 25  |   await page.waitForURL(/\/(dashboard|bienvenida|portal|mfa)/, { timeout: 15_000 })
      |              ^ TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
  26  |   // Si cae en MFA enroll/challenge, lo consideramos login exitoso (token válido)
  27  | }
  28  | 
  29  | async function medirTiempo(label: string, fn: () => Promise<void>): Promise<number> {
  30  |   const t0 = Date.now()
  31  |   await fn()
  32  |   const ms = Date.now() - t0
  33  |   console.log(`⏱  ${label}: ${ms}ms`)
  34  |   return ms
  35  | }
  36  | 
  37  | // ── 1. LOGIN — UX / UI / Velocidad ───────────────────────────────────────────
  38  | test.describe('1 · Login — UX, UI, Performance', () => {
  39  | 
  40  |   test('página de login carga en < 3s y muestra elementos clave', async ({ page }) => {
  41  |     const ms = await medirTiempo('login page load', async () => {
  42  |       await page.goto('/login')
  43  |       await expect(page.locator('input[type="email"]')).toBeVisible()
  44  |     })
  45  |     expect(ms).toBeLessThan(3000)
  46  | 
  47  |     // Verifica elementos de UI
  48  |     await expect(page.locator('text=ProcessOS')).toBeVisible()
  49  |     await expect(page.locator('text=Acceso al portal')).toBeVisible()
  50  |     await expect(page.locator('input[type="email"]')).toBeVisible()
  51  |     await expect(page.locator('input[type="password"]')).toBeVisible()
  52  |     await expect(page.locator('button[type="submit"]')).toBeVisible()
  53  |     await expect(page.locator('text=MFA activo')).toBeVisible()
  54  |     await expect(page.locator('text=Recordar dispositivo')).toBeVisible()
  55  |   })
  56  | 
  57  |   test('el carrusel animado rota automáticamente', async ({ page }) => {
  58  |     await page.goto('/login')
  59  |     await page.waitForTimeout(3500)
  60  |     // Verifica que los dots del carrusel existen
  61  |     const dots = page.locator('button[style*="border-radius: 3px"]')
  62  |     await expect(dots.first()).toBeVisible()
  63  |   })
  64  | 
  65  |   test('mostrar/ocultar contraseña funciona', async ({ page }) => {
  66  |     await page.goto('/login')
  67  |     const input = page.locator('input[type="password"]')
  68  |     await input.fill('MiPassword123')
  69  |     await expect(input).toHaveAttribute('type', 'password')
  70  |     // Click en el ojo
  71  |     await page.locator('button[type="button"]').click()
  72  |     await expect(page.locator('input[type="text"]')).toBeVisible()
  73  |   })
  74  | 
  75  |   test('credenciales incorrectas muestra error claro', async ({ page }) => {
  76  |     await page.goto('/login')
  77  |     await page.locator('input[type="email"]').fill('incorrecto@test.cl')
  78  |     await page.locator('input[type="password"]').fill('WrongPass!')
  79  |     await page.locator('button[type="submit"]').click()
  80  |     await expect(page.getByText(/credenciales proporcionadas/i)).toBeVisible({ timeout: 8_000 })
  81  |   })
  82  | 
  83  |   test('login cliente exitoso y redirige a destino válido', async ({ page }) => {
  84  |     const ms = await medirTiempo('login + redirect', async () => {
  85  |       await loginAs(page, CLIENTE_EMAIL, CLIENTE_PASSWORD)
  86  |     })
  87  |     expect(ms).toBeLessThan(8000)
  88  |     // Portal o MFA (si tiene MFA configurado)
  89  |     await expect(page).toHaveURL(/\/(portal|mfa|dashboard|bienvenida)/)
  90  |   })
  91  | 
  92  | })
  93  | 
  94  | // ── 2. PORTAL CLIENTE — Flujo principal ──────────────────────────────────────
  95  | test.describe('2 · Portal Cliente — Journey completo', () => {
  96  | 
  97  |   test.beforeEach(async ({ page }) => {
  98  |     await loginAs(page, CLIENTE_EMAIL, CLIENTE_PASSWORD)
  99  |     if (page.url().includes('/mfa')) await page.goto('/portal')
  100 |   })
  101 | 
  102 |   test('portal carga y muestra zona de carga de documentos', async ({ page }) => {
  103 |     // Si quedó en MFA, ir directo al portal
  104 |     if (page.url().includes('/mfa')) {
  105 |       await page.goto('/portal')
  106 |     }
  107 |     await expect(page).toHaveURL(/\/portal/)
  108 |     const ms = await medirTiempo('portal load', async () => {
  109 |       await expect(page.locator('text=/subir|cargar|documento/i').first()).toBeVisible({ timeout: 10_000 })
  110 |     })
  111 |     expect(ms).toBeLessThan(8000)
  112 |   })
  113 | 
  114 |   test('sidebar muestra solo opciones de cliente', async ({ page }) => {
  115 |     // Cliente solo ve Mi Portal y Zona de Implementación
  116 |     await expect(page.locator('text=Mi Portal')).toBeVisible()
  117 |     await expect(page.locator('text=Zona de Implementación')).toBeVisible()
  118 | 
  119 |     // NO debe ver opciones internas
  120 |     await expect(page.locator('text=Clientes e Industrias')).not.toBeVisible()
  121 |     await expect(page.locator('text=Process Discovery AI')).not.toBeVisible()
  122 |     await expect(page.locator('text=Administración')).not.toBeVisible()
  123 |   })
  124 | 
  125 |   test('zona de implementación es accesible desde el portal', async ({ page }) => {
```
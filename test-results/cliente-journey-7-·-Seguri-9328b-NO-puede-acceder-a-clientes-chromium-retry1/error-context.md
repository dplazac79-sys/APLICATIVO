# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cliente-journey.spec.ts >> 7 · Seguridad — Aislamiento de roles >> cliente NO puede acceder a /clientes
- Location: tests/playwright/cliente-journey.spec.ts:329:7

# Error details

```
Error: expect(page).not.toHaveURL(expected) failed

Expected pattern: not /\/clientes/
Received string: "https://aplicativo-production.up.railway.app/clientes"
Timeout: 5000ms

Call log:
  - Expect "not toHaveURL" with timeout 5000ms
    14 × unexpected value "https://aplicativo-production.up.railway.app/clientes"

```

```yaml
- complementary:
  - text: AC
  - paragraph: ProcessOS
  - paragraph: BY AICOUNTS CONSULTORES
  - navigation:
    - link "Mi Portal":
      - /url: /portal
    - link "Zona de Implementación":
      - /url: /implementacion
    - link "Bienvenida":
      - /url: /bienvenida
    - link "Dashboard":
      - /url: /dashboard
    - link "Centro Documental":
      - /url: /documentos
    - link "Artefactos Fase 3":
      - /url: /artefactos
    - link "Project Control Center":
      - /url: /proyectos
    - link "Horizonte de Impacto Fase 5":
      - /url: /impacto
  - paragraph: AICOUNTS Consultores © 2026
- banner:
  - button "MG María González Sponsor Cliente":
    - text: MG
    - paragraph: María González
    - paragraph: Sponsor Cliente
- main:
  - heading "Clientes e Industrias" [level=1]
  - paragraph: Vista 360° por cliente e industria
  - link "Nuevo cliente":
    - /url: /clientes/nuevo
    - button "Nuevo cliente"
  - link "Empresa Demo S.A. Retail · mediana · 1 proyecto activo":
    - /url: /clientes/923bcdbb-33f7-40b0-997d-2a5585c0193f
    - heading "Empresa Demo S.A." [level=3]
    - text: Retail · mediana · 1 proyecto activo
  - region "Notifications alt+T"
- alert
```

# Test source

```ts
  232 |     const viewportWidth = 390
  233 |     expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5) // 5px de tolerancia
  234 |   })
  235 | 
  236 | })
  237 | 
  238 | // ── 5. RESPONSIVE — Tablet 768px ─────────────────────────────────────────────
  239 | test.describe('5 · Responsive — Tablet (768×1024)', () => {
  240 | 
  241 |   test.use({ viewport: { width: 768, height: 1024 } })
  242 | 
  243 |   test('login en tablet — layout correcto', async ({ page }) => {
  244 |     await page.goto('/login')
  245 |     await expect(page.locator('input[type="email"]')).toBeVisible()
  246 |     await expect(page.locator('button[type="submit"]')).toBeVisible()
  247 |   })
  248 | 
  249 |   test('dashboard en tablet sin desborde', async ({ page }) => {
  250 |     await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  251 |     await page.goto('/dashboard')
  252 |     await page.waitForLoadState('networkidle')
  253 |     const bodyWidth = await page.locator('body').evaluate(el => el.scrollWidth)
  254 |     expect(bodyWidth).toBeLessThanOrEqual(780)
  255 |   })
  256 | 
  257 | })
  258 | 
  259 | // ── 6. PERFORMANCE — Core Web Vitals aproximados ─────────────────────────────
  260 | test.describe('6 · Performance — Tiempos de carga', () => {
  261 | 
  262 |   test('login < 3s', async ({ page }) => {
  263 |     const ms = await medirTiempo('/login', async () => {
  264 |       await page.goto('/login')
  265 |       await page.waitForLoadState('networkidle')
  266 |     })
  267 |     expect(ms).toBeLessThan(3000)
  268 |   })
  269 | 
  270 |   test('dashboard < 5s (post login)', async ({ page }) => {
  271 |     await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  272 |     const ms = await medirTiempo('/dashboard networkidle', async () => {
  273 |       await page.goto('/dashboard')
  274 |       await page.waitForLoadState('networkidle')
  275 |     })
  276 |     expect(ms).toBeLessThan(5000)
  277 |   })
  278 | 
  279 |   test('portal cliente < 5s', async ({ page }) => {
  280 |     await loginAs(page, CLIENTE_EMAIL, CLIENTE_PASSWORD)
  281 |     const ms = await medirTiempo('/portal networkidle', async () => {
  282 |       await page.goto('/portal')
  283 |       await page.waitForLoadState('networkidle')
  284 |     })
  285 |     expect(ms).toBeLessThan(5000)
  286 |   })
  287 | 
  288 |   test('no hay errores de consola críticos en login', async ({ page }) => {
  289 |     const errors: string[] = []
  290 |     page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  291 |     await page.goto('/login')
  292 |     await page.waitForLoadState('networkidle')
  293 |     // Filtra errores conocidos/aceptables
  294 |     const critical = errors.filter(e =>
  295 |       !e.includes('favicon') &&
  296 |       !e.includes('hydrat') &&
  297 |       !e.includes('Warning:')
  298 |     )
  299 |     if (critical.length > 0) console.warn('Errores consola:', critical)
  300 |     expect(critical.length).toBe(0)
  301 |   })
  302 | 
  303 |   test('no hay errores de consola críticos en portal cliente', async ({ page }) => {
  304 |     const errors: string[] = []
  305 |     page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  306 |     await loginAs(page, CLIENTE_EMAIL, CLIENTE_PASSWORD)
  307 |     await page.waitForLoadState('networkidle')
  308 |     const critical = errors.filter(e =>
  309 |       !e.includes('favicon') &&
  310 |       !e.includes('hydrat') &&
  311 |       !e.includes('Warning:')
  312 |     )
  313 |     if (critical.length > 0) console.warn('Errores consola:', critical)
  314 |     expect(critical.length).toBe(0)
  315 |   })
  316 | 
  317 | })
  318 | 
  319 | // ── 7. SEGURIDAD — Acceso y aislamiento ──────────────────────────────────────
  320 | test.describe('7 · Seguridad — Aislamiento de roles', () => {
  321 | 
  322 |   test('cliente NO puede acceder a /dashboard', async ({ page }) => {
  323 |     await loginAs(page, CLIENTE_EMAIL, CLIENTE_PASSWORD)
  324 |     await page.goto('/dashboard')
  325 |     // Debe redirigir o mostrar acceso denegado
  326 |     await expect(page).not.toHaveURL(/\/dashboard/, { timeout: 5_000 })
  327 |   })
  328 | 
  329 |   test('cliente NO puede acceder a /clientes', async ({ page }) => {
  330 |     await loginAs(page, CLIENTE_EMAIL, CLIENTE_PASSWORD)
  331 |     await page.goto('/clientes')
> 332 |     await expect(page).not.toHaveURL(/\/clientes/, { timeout: 5_000 })
      |                            ^ Error: expect(page).not.toHaveURL(expected) failed
  333 |   })
  334 | 
  335 |   test('cliente NO puede acceder a /admin', async ({ page }) => {
  336 |     await loginAs(page, CLIENTE_EMAIL, CLIENTE_PASSWORD)
  337 |     await page.goto('/admin')
  338 |     await expect(page).not.toHaveURL(/\/admin/, { timeout: 5_000 })
  339 |   })
  340 | 
  341 |   test('ruta protegida sin sesión → redirige a login', async ({ page }) => {
  342 |     await page.goto('/portal')
  343 |     await expect(page).toHaveURL(/\/login/, { timeout: 8_000 })
  344 |   })
  345 | 
  346 | })
  347 | 
```
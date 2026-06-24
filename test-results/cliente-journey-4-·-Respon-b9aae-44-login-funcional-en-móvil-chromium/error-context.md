# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cliente-journey.spec.ts >> 4 · Responsive — Mobile (390×844) >> login funcional en móvil
- Location: tests/playwright/cliente-journey.spec.ts:218:7

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/portal/
Received string:  "https://aplicativo-production.up.railway.app/mfa/enroll"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    14 × unexpected value "https://aplicativo-production.up.railway.app/mfa/enroll"

```

```yaml
- alert
- heading "Activa la verificación en dos pasos" [level=1]
- paragraph: ProcessOS requiere MFA para todos los perfiles
- text: Configura tu autenticador Escanea el código QR con Google Authenticator, Authy o cualquier app TOTP
- img "Código QR para MFA"
- paragraph: "¿No puedes escanear? Ingresa este código manualmente:"
- paragraph: VX3FUQ3ESR6OBTHE66PSK5YOPWTVJNFZ
- text: Código de 6 dígitos
- textbox "Código de 6 dígitos":
  - /placeholder: "000000"
- button "Activar y continuar" [disabled]
```

# Test source

```ts
  120 |     await expect(page.locator('text=Clientes e Industrias')).not.toBeVisible()
  121 |     await expect(page.locator('text=Process Discovery AI')).not.toBeVisible()
  122 |     await expect(page.locator('text=Administración')).not.toBeVisible()
  123 |   })
  124 | 
  125 |   test('zona de implementación es accesible desde el portal', async ({ page }) => {
  126 |     await page.locator('text=Zona de Implementación').click()
  127 |     await expect(page).toHaveURL(/\/implementacion/)
  128 |     await expect(page.locator('text=/implementaci/i').first()).toBeVisible({ timeout: 6_000 })
  129 |   })
  130 | 
  131 |   test('drag & drop zona es visible y tiene instrucciones claras', async ({ page }) => {
  132 |     await expect(page.locator('text=/arrastr|drag|soltar|PDF|DOCX/i').first()).toBeVisible({ timeout: 6_000 })
  133 |   })
  134 | 
  135 |   test('upload de archivo inválido muestra error apropiado', async ({ page }) => {
  136 |     // Intenta subir un .txt (tipo inválido)
  137 |     const fileInput = page.locator('input[type="file"]')
  138 |     if (await fileInput.count() > 0) {
  139 |       await fileInput.setInputFiles({
  140 |         name: 'test.txt',
  141 |         mimeType: 'text/plain',
  142 |         buffer: Buffer.from('contenido de prueba'),
  143 |       })
  144 |       // Debe mostrar error de tipo de archivo
  145 |       await expect(page.locator('text=/PDF|DOCX|formato/i').first()).toBeVisible({ timeout: 4_000 })
  146 |     } else {
  147 |       console.log('ℹ️  No hay input file directo (drag & drop), se omite validación de tipo')
  148 |       test.skip()
  149 |     }
  150 |   })
  151 | 
  152 | })
  153 | 
  154 | // ── 3. ADMIN — Flujo interno ──────────────────────────────────────────────────
  155 | test.describe('3 · Admin — Flujo interno', () => {
  156 | 
  157 |   test.beforeEach(async ({ page }) => {
  158 |     await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  159 |     if (page.url().includes('/mfa')) await page.goto('/dashboard')
  160 |   })
  161 | 
  162 |   test('dashboard carga en < 4s con métricas visibles', async ({ page }) => {
  163 |     await page.goto('/dashboard')
  164 |     const ms = await medirTiempo('dashboard load', async () => {
  165 |       await page.waitForLoadState('networkidle')
  166 |     })
  167 |     expect(ms).toBeLessThan(4000)
  168 |     await expect(page).toHaveURL(/\/dashboard/)
  169 |   })
  170 | 
  171 |   test('sidebar admin muestra todas las opciones', async ({ page }) => {
  172 |     for (const label of ['Dashboard', 'Clientes e Industrias', 'Centro Documental', 'Process Discovery AI']) {
  173 |       await expect(page.locator(`text=${label}`).first()).toBeVisible()
  174 |     }
  175 |   })
  176 | 
  177 |   test('clientes page carga y lista proyectos', async ({ page }) => {
  178 |     await page.goto('/clientes')
  179 |     await expect(page).toHaveURL(/\/clientes/)
  180 |     await page.waitForLoadState('networkidle')
  181 |     // Debe haber al menos un cliente o mensaje vacío
  182 |     const content = await page.content()
  183 |     expect(content.length).toBeGreaterThan(500)
  184 |   })
  185 | 
  186 |   test('discovery AI page carga correctamente', async ({ page }) => {
  187 |     await page.goto('/discovery')
  188 |     await expect(page).toHaveURL(/\/discovery/)
  189 |     await page.waitForLoadState('networkidle')
  190 |     await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 6_000 })
  191 |   })
  192 | 
  193 |   test('documentos page carga sin errores', async ({ page }) => {
  194 |     await page.goto('/documentos')
  195 |     await page.waitForLoadState('networkidle')
  196 |     await expect(page).toHaveURL(/\/documentos/)
  197 |   })
  198 | 
  199 | })
  200 | 
  201 | // ── 4. RESPONSIVE — Mobile 390px ─────────────────────────────────────────────
  202 | test.describe('4 · Responsive — Mobile (390×844)', () => {
  203 | 
  204 |   test.use({ viewport: { width: 390, height: 844 } })
  205 | 
  206 |   test('login se ve bien en iPhone 14', async ({ page }) => {
  207 |     await page.goto('/login')
  208 |     await expect(page.locator('input[type="email"]')).toBeVisible()
  209 |     await expect(page.locator('input[type="password"]')).toBeVisible()
  210 |     await expect(page.locator('button[type="submit"]')).toBeVisible()
  211 | 
  212 |     // El formulario no debe desbordar horizontalmente
  213 |     const body = page.locator('body')
  214 |     const bodyWidth = await body.evaluate(el => el.scrollWidth)
  215 |     expect(bodyWidth).toBeLessThanOrEqual(400)
  216 |   })
  217 | 
  218 |   test('login funcional en móvil', async ({ page }) => {
  219 |     await loginAs(page, CLIENTE_EMAIL, CLIENTE_PASSWORD)
> 220 |     await expect(page).toHaveURL(/\/portal/)
      |                        ^ Error: expect(page).toHaveURL(expected) failed
  221 |   })
  222 | 
  223 |   test('sidebar móvil: muestra botón hamburguesa', async ({ page }) => {
  224 |     await loginAs(page, CLIENTE_EMAIL, CLIENTE_PASSWORD)
  225 |     // El sidebar desktop debe estar oculto, debe haber un trigger móvil
  226 |     await expect(page.locator('.hidden.md\\:flex, [class*="hidden md:"]')).toBeDefined()
  227 |   })
  228 | 
  229 |   test('portal cliente en móvil no tiene scroll horizontal', async ({ page }) => {
  230 |     await loginAs(page, CLIENTE_EMAIL, CLIENTE_PASSWORD)
  231 |     const bodyWidth = await page.locator('body').evaluate(el => el.scrollWidth)
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
```
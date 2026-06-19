/**
 * E2E: Crear cliente y proyecto desde la UI
 * Requiere sesión activa de super_admin (sin MFA) o director_proyecto.
 */
import { test, expect, Page } from '@playwright/test'

const EMAIL    = process.env.E2E_USER_EMAIL    ?? ''
const PASSWORD = process.env.E2E_USER_PASSWORD ?? ''
const TS       = Date.now()

async function login(page: Page) {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(EMAIL)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/(dashboard|bienvenida|portal)/, { timeout: 15_000 })
}

test.describe('Clientes y Proyectos', () => {
  test('crear nuevo cliente aparece en la lista', async ({ page }) => {
    await login(page)
    await page.goto('/clientes')

    // Abrir formulario de nuevo cliente
    await page.getByRole('button', { name: /nuevo cliente|agregar cliente/i }).click()

    const nombre = `__E2E_Cliente_${TS}__`
    await page.getByLabel(/razón social|nombre/i).fill(nombre)
    await page.getByLabel(/industria/i).fill('Tecnología')

    // Seleccionar tamaño si existe el campo
    const tamanoSelect = page.getByLabel(/tamaño|tamano/i)
    if (await tamanoSelect.count() > 0) {
      await tamanoSelect.selectOption({ index: 1 })
    }

    await page.getByRole('button', { name: /guardar|crear|confirmar/i }).click()

    // Verificar que aparece en la lista
    await expect(page.getByText(nombre)).toBeVisible({ timeout: 10_000 })
  })

  test('crear proyecto para un cliente existente', async ({ page }) => {
    await login(page)
    await page.goto('/proyectos')

    await page.getByRole('button', { name: /nuevo proyecto|agregar proyecto/i }).click()

    const nombre = `__E2E_Proyecto_${TS}__`
    await page.getByLabel(/nombre.*proyecto|proyecto/i).first().fill(nombre)

    // Seleccionar cliente — elige el primero disponible
    const clienteSelect = page.getByLabel(/cliente/i)
    if (await clienteSelect.count() > 0) {
      await clienteSelect.selectOption({ index: 1 })
    }

    await page.getByRole('button', { name: /guardar|crear|confirmar/i }).click()

    await expect(page.getByText(nombre)).toBeVisible({ timeout: 10_000 })
  })
})

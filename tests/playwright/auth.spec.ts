/**
 * E2E: Autenticación — login con email/password y redirección post-login
 * No prueba MFA TOTP porque requiere app de autenticador física.
 * Prueba: login OK → dashboard, login fallido → mensaje error.
 *
 * Variables requeridas en .env.local:
 *   E2E_USER_EMAIL    — usuario super_admin de prueba
 *   E2E_USER_PASSWORD — contraseña del usuario
 */
import { test, expect } from '@playwright/test'

const EMAIL    = process.env.E2E_USER_EMAIL    ?? ''
const PASSWORD = process.env.E2E_USER_PASSWORD ?? ''

test.describe('Login', () => {
  test('login exitoso redirige a dashboard o bienvenida', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/\/login/)

    await page.locator('input[type="email"]').fill(EMAIL)
    await page.locator('input[type="password"]').fill(PASSWORD)
    await page.locator('button[type="submit"]').click()

    // Acepta dashboard, bienvenida o mfa/challenge (si MFA activo)
    await expect(page).toHaveURL(/\/(dashboard|bienvenida|mfa|portal)/, { timeout: 15_000 })
  })

  test('credenciales incorrectas muestra error', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill('noexiste@apac.cl')
    await page.locator('input[type="password"]').fill('WrongPass999!')
    await page.locator('button[type="submit"]').click()

    await expect(
      page.getByText('Las credenciales proporcionadas no corresponden a un perfil activo.')
    ).toBeVisible({ timeout: 8_000 })

    await expect(page).toHaveURL(/\/login/)
  })

  test('ruta protegida sin sesión redirige a login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 })
  })
})

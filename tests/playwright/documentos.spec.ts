/**
 * E2E: Subida de documento
 * Verifica que un PDF de prueba se sube, aparece en la lista y queda encolado para IA.
 */
import { test, expect, Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const EMAIL    = process.env.E2E_USER_EMAIL    ?? ''
const PASSWORD = process.env.E2E_USER_PASSWORD ?? ''

async function login(page: Page) {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(EMAIL)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/(dashboard|bienvenida|portal)/, { timeout: 15_000 })
}

// Crea un PDF mínimo en memoria para el test
function crearPdfPrueba(): string {
  const tmpPath = path.join('/tmp', `e2e-test-${Date.now()}.pdf`)
  // PDF mínimo válido de 1 página en blanco
  const pdfContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
217
%%EOF`
  fs.writeFileSync(tmpPath, pdfContent)
  return tmpPath
}

test.describe('Documentos', () => {
  test('subir documento PDF aparece en la lista como procesando', async ({ page }) => {
    await login(page)
    await page.goto('/documentos')

    const pdfPath = crearPdfPrueba()

    // Seleccionar proyecto (primer proyecto disponible)
    const proyectoSelect = page.locator('[data-testid="proyecto-select"], select').first()
    if (await proyectoSelect.count() > 0) {
      await proyectoSelect.selectOption({ index: 1 }).catch(() => null)
    }

    // Adjuntar archivo via input file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(pdfPath)

    // Verificar que aparece en la lista de archivos pendientes
    await expect(page.getByText(/e2e-test/i)).toBeVisible({ timeout: 5_000 })

    // Hacer clic en cargar
    await page.getByRole('button', { name: /cargar|subir|upload/i }).click()

    // Verificar toast de éxito o que aparece en la lista de documentos
    await expect(
      page.getByText(/cargado|procesando|encolado|subido/i)
    ).toBeVisible({ timeout: 15_000 })

    fs.unlinkSync(pdfPath)
  })

  test('la página de documentos carga sin errores', async ({ page }) => {
    await login(page)
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/documentos')
    await expect(page).toHaveURL(/\/documentos/)

    // Sin errores críticos en consola
    const criticos = errors.filter(e =>
      !e.includes('favicon') && !e.includes('404') && !e.includes('hydrat')
    )
    expect(criticos).toHaveLength(0)
  })
})

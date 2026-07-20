import { defineConfig, devices } from '@playwright/test'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '.env.local') })

export default defineConfig({
  testDir: './tests/playwright',
  timeout: 60_000,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Antes no había webServer — se asumía que alguien ya tenía `npm run dev`
  // corriendo en localhost:3000 manualmente. Sin esto, CI no tiene forma de
  // levantar la app antes de correr los 37 escenarios (hallazgo de
  // auditoría: esta suite nunca corrió en CI). reuseExistingServer permite
  // seguir usándolo igual que antes en desarrollo local.
  webServer: {
    command: 'npm run start',
    url: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})

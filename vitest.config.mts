import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts', 'tests/e2e/**/*.test.ts'],
    exclude: ['tests/ai-fixtures/**'],
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 60000,
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/lib/**/*.ts'],
      exclude: [
        'src/lib/supabase/**',
        'src/lib/inngest/client.ts',
        'src/lib/ai/client.ts',
        'src/lib/**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // 'server-only' throws when imported outside Next's own server
      // rendering pipeline — vitest runs plain Node, so any module guarded
      // with `import 'server-only'` (added in the frontend security audit,
      // e.g. src/lib/fases.ts) crashed at import time here, with zero
      // tests actually running. Alias it to a no-op for tests, same
      // approach Next.js's own testing docs recommend.
      'server-only': path.resolve(__dirname, './tests/mocks/server-only.ts'),
    },
  },
})

import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  outputDir: './results',
  timeout: 30000,
  fullyParallel: true,
  workers: 3,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: './results/report.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:4294',
    viewport: { width: 920, height: 740 },
    trace: 'retain-on-failure',
  },
  projects: ['chromium', 'firefox', 'webkit'].map((browserName) => ({
    name: browserName,
    use: { browserName },
  })),
  webServer: {
    command: `${process.execPath} benchmarks/web-gestures/server.mjs`,
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    url: 'http://127.0.0.1:4294',
    reuseExistingServer: false,
  },
})

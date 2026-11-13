import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  outputDir: './results',
  timeout: 30000,
  workers: 3,
  retries: 0,
  reporter: [
    ['list'],
    [
      'json',
      { outputFile: fileURLToPath(new URL('./results/report.json', import.meta.url)) },
    ],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4341',
    viewport: { width: 1000, height: 760 },
    trace: 'retain-on-failure',
  },
  projects: ['chromium', 'firefox', 'webkit'].map((browserName) => ({
    name: browserName,
    use: { browserName },
  })),
  webServer: {
    command: `${process.execPath} benchmarks/values-scroll-lists/server.mjs`,
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    url: 'http://127.0.0.1:4341',
    reuseExistingServer: false,
  },
})

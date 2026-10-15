import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@nativescript/core/ui/text-base': fileURLToPath(
        new URL('./test/shims/core.ts', import.meta.url),
      ),
      '@nativescript/core': fileURLToPath(
        new URL('./test/shims/core.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['test/**/*.spec.ts'],
  },
})

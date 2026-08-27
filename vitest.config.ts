import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Тесты, которым нужна база, берут DATABASE_URL_TEST — отдельную базу,
    // никогда не рабочую (docs/03-data-model.md).
    env: { NODE_ENV: 'test' },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})

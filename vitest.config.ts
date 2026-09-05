import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

// Тесты, которым нужна база, читают DATABASE_URL_TEST. Vitest сам .env
// не загружает, поэтому делаем это здесь — отсутствие файла не ошибка:
// в сборочной среде переменные приходят снаружи
if (existsSync('.env')) process.loadEnvFile('.env')

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Отдельная тестовая база, никогда не рабочая (docs/03-data-model.md)
    env: { NODE_ENV: 'test' },
    // Тесты с базой пишут в общие таблицы, поэтому идут по одному файлу за раз
    fileParallelism: false,
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})

import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { config } from '@/shared/config'

/**
 * Накат миграций. Запускается скриптом деплоя до перезапуска приложения.
 * Отдельное соединение с max: 1 — миграции идут последовательно.
 */
async function main(): Promise<void> {
  const cfg = config()
  const url = cfg.NODE_ENV === 'test' ? (cfg.DATABASE_URL_TEST ?? cfg.DATABASE_URL) : cfg.DATABASE_URL
  const client = postgres(url, { max: 1 })
  try {
    await migrate(drizzle(client), { migrationsFolder: './drizzle' })
    console.log('Миграции накачены')
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  console.error('Миграции не накатились:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})

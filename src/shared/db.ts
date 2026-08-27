import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { config } from './config'

/**
 * Подключение к PostgreSQL. Ленивое: импорт модуля соединение не открывает,
 * иначе сборка требовала бы живую базу.
 *
 * База — только на сервере в РФ (§8). Тесты ходят в DATABASE_URL_TEST,
 * отдельную базу, и никогда в рабочую.
 */

export type Db = ReturnType<typeof drizzle>

let client: ReturnType<typeof postgres> | undefined
let db: Db | undefined

function connectionUrl(): string {
  const cfg = config()
  if (cfg.NODE_ENV === 'test') {
    if (!cfg.DATABASE_URL_TEST) {
      throw new Error(
        'NODE_ENV=test, но DATABASE_URL_TEST не задан. Тесты не должны ходить в рабочую базу.',
      )
    }
    return cfg.DATABASE_URL_TEST
  }
  return cfg.DATABASE_URL
}

export function getDb(): Db {
  if (db) return db
  client = postgres(connectionUrl(), { max: 10, prepare: false })
  db = drizzle(client)
  return db
}

/** Закрыть пул — для воркера при остановке и для тестов. */
export async function closeDb(): Promise<void> {
  if (client) await client.end({ timeout: 5 })
  client = undefined
  db = undefined
}

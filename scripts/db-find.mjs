import postgres from 'postgres'

/**
 * Найти базу данных самостоятельно.
 *
 * Человек не должен знать, как называется модуль в его панели и какой у базы
 * пароль: программа перебирает обычные варианты и берёт первый работающий.
 * Это убирает единственный шаг, где нужно было руками править файл настроек.
 */
const HOSTS = [
  '127.0.0.1',
  'localhost',
  // Open Server Panel 6 обращается к базе по имени модуля, а не по localhost
  'PostgreSQL-17', 'PostgreSQL-16', 'PostgreSQL-15', 'PostgreSQL-14',
  'PostgreSQL-13', 'PostgreSQL-12',
  'PostgreSQL-17.local', 'PostgreSQL-16.local', 'PostgreSQL-15.local',
]
const PASSWORDS = ['', 'postgres', 'root']
const USER = 'postgres'

export async function findDatabase() {
  for (const host of HOSTS) {
    for (const password of PASSWORDS) {
      const url = `postgres://${USER}${password ? `:${password}` : ''}@${host}:5432/postgres`
      const sql = postgres(url, {
        max: 1, prepare: false, connect_timeout: 3, onnotice: () => {},
      })
      try {
        await sql`select 1`
        await sql.end({ timeout: 2 })
        return { host, password }
      } catch (error) {
        await sql.end({ timeout: 2 }).catch(() => {})
        // Имя не разрешается — остальные пароли для него проверять незачем
        const code = error?.code ?? error?.cause?.code
        if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || code === 'ECONNREFUSED') break
      }
    }
  }
  return null
}

/** Отвечает ли база по этому адресу. Пустой адрес — сразу нет. */
export async function canConnect(url) {
  if (!url) return false
  let sql
  try {
    sql = postgres(url, { max: 1, prepare: false, connect_timeout: 3, onnotice: () => {} })
    await sql`select 1`
    return true
  } catch {
    return false
  } finally {
    await sql?.end({ timeout: 2 }).catch(() => {})
  }
}

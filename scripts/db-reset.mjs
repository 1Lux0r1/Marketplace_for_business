/**
 * Стереть все данные, оставив структуру.
 *
 * Нужно для пробных прогонов на своей машине: «начать заново» иначе делается
 * через отдельную программу для баз данных, а это лишний инструмент ради
 * одного действия.
 *
 * Спрашивает подтверждение словом и отказывается работать в проде: данные
 * заказчиков не стираются по нажатию не той кнопки.
 */
import { createInterface } from 'node:readline/promises'
import postgres from 'postgres'

const WORD = 'СТЕРЕТЬ'

if (process.env.NODE_ENV === 'production') {
  console.error('Это рабочий сервер. Стирать данные здесь нельзя.')
  process.exit(1)
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL не задан. Сначала запустите настройку: setup.bat')
  process.exit(1)
}

const rl = createInterface({ input: process.stdin, output: process.stdout })
console.log(`
Это удалит ВСЕ данные: компании, людей, пароли, входы и письма.
Структура таблиц останется, регистрироваться можно будет заново.
Отменить это нельзя.
`)
const answer = await rl.question(`Чтобы продолжить, наберите ${WORD} и нажмите Enter: `)
rl.close()

if (answer.trim().toUpperCase() !== WORD) {
  console.log('\nНичего не тронул.')
  process.exit(0)
}

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} })
try {
  // Список берём из базы, а не из кода: иначе после новой таблицы
  // очистка тихо перестанет быть полной
  const tables = await sql`
    select schemaname, tablename from pg_tables
    where schemaname in ('platform', 'notifications', 'catalog', 'intake',
                         'matching', 'deal', 'documents', 'payments', 'analytics')`

  if (tables.length === 0) {
    console.log('\nТаблиц нет — стирать нечего.')
  } else {
    const list = tables.map((t) => `"${t.schemaname}"."${t.tablename}"`).join(', ')
    await sql.unsafe(`truncate ${list} restart identity cascade`)
    console.log(`\nГотово: очищено таблиц — ${tables.length}. База пустая, структура на месте.`)
  }
} catch (error) {
  console.error('\nНе получилось.')
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}

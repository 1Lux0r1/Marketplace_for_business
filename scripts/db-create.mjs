/**
 * Создать базы, если их ещё нет.
 *
 * Нужен для первого запуска на своей машине: иначе базы заводят руками через
 * pgAdmin, и на этом шаге чаще всего спотыкаются. Скрипт безопасен для повтора —
 * существующие базы он не трогает и данные не удаляет.
 *
 * Адреса берёт из `.env`, поэтому создаёт ровно то, к чему потом подключится
 * приложение: разойтись они не могут.
 */
import postgres from 'postgres'

const targets = [
  ['DATABASE_URL', process.env.DATABASE_URL, 'рабочая'],
  ['DATABASE_URL_TEST', process.env.DATABASE_URL_TEST, 'для тестов'],
]

let created = 0
let failed = false

for (const [name, url, purpose] of targets) {
  if (!url) {
    console.log(`- ${name} не задан в .env — пропускаю`)
    continue
  }

  let parsed
  try {
    parsed = new URL(url)
  } catch {
    console.error(`! ${name}: не похоже на адрес базы — «${url}»`)
    failed = true
    continue
  }

  const database = decodeURIComponent(parsed.pathname.slice(1))
  if (!database) {
    console.error(`! ${name}: в адресе не указано имя базы`)
    failed = true
    continue
  }

  // Подключаемся к служебной базе postgres: создать базу, сидя в ней самой,
  // нельзя — её ещё не существует
  const admin = new URL(url)
  admin.pathname = '/postgres'

  const sql = postgres(admin.toString(), { max: 1, prepare: false, onnotice: () => {} })
  try {
    const [existing] = await sql`select 1 from pg_database where datname = ${database}`
    if (existing) {
      console.log(`= база «${database}» (${purpose}) уже есть`)
    } else {
      // Имя базы нельзя подставить параметром — только в текст запроса,
      // поэтому экранируем кавычки сами
      await sql.unsafe(`create database "${database.replaceAll('"', '""')}"`)
      console.log(`+ создана база «${database}» (${purpose})`)
      created += 1
    }
  } catch (error) {
    console.error(`! ${name}: ${error instanceof Error ? error.message : String(error)}`)
    failed = true
  } finally {
    await sql.end({ timeout: 5 })
  }
}

if (failed) {
  console.error('\nБазы созданы не все. Проверьте, что PostgreSQL запущен,')
  console.error('а логин и пароль в .env совпадают с теми, что у сервера базы.')
  process.exit(1)
}

console.log(created ? '\nГотово. Дальше: pnpm db:migrate' : '\nВсё на месте, создавать нечего.')

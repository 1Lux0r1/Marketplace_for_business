/**
 * Первая настройка на своей машине: подготовить `.env`, найти базу,
 * создать её и накатить структуру.
 *
 * Задача этого файла — чтобы человеку не пришлось ничего править руками.
 * Поэтому база ищется сама: имя модуля и пароль в разных установках разные,
 * а знать их наизусть человек не обязан.
 *
 * Повторный запуск безопасен: рабочие настройки не переписываются,
 * существующие базы не трогаются.
 */
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { findDatabase, canConnect } from './db-find.mjs'

const NODE_MINIMUM = 22

step('Проверяю Node.js')
const major = Number(process.versions.node.split('.')[0])
if (major < NODE_MINIMUM) {
  fail(
    `Нужен Node.js ${NODE_MINIMUM} или новее, а установлен ${process.versions.node}.`,
    'Скачайте с https://nodejs.org — кнопка LTS.',
  )
}
console.log(`  Node.js ${process.versions.node} — подходит`)

step('Готовлю файл настроек')
if (!existsSync('.env')) {
  if (!existsSync('.env.example')) {
    fail('Не нашёл файл .env.example — видимо, папка проекта скачана не целиком.')
  }
  copyFileSync('.env.example', '.env')
  // Ключ подписи сессий: без него приложение не стартует, а придумывать
  // его руками человек не должен
  patchEnv({ SESSION_SECRET: randomBytes(48).toString('base64') })
  console.log('  Создал .env и сгенерировал ключ подписи')
} else {
  console.log('  Файл уже есть')
}

step('Ищу базу данных')
const current = readEnv()
if (await canConnect(current.DATABASE_URL)) {
  console.log('  Настройки из .env подходят — оставляю как есть')
} else {
  console.log('  Перебираю обычные варианты, это несколько секунд...')
  const found = await findDatabase()
  if (!found) {
    fail(
      'База не отвечает ни по одному из обычных адресов.',
      '',
      'Что проверить:',
      '  1. В панели включён и запущен модуль PostgreSQL.',
      '  2. Версия модуля — 16 или новее.',
      '',
      'Включите модуль и запустите этот файл ещё раз.',
    )
  }
  const auth = `postgres${found.password ? `:${found.password}` : ''}@${found.host}:5432`
  patchEnv({
    DATABASE_URL: `postgres://${auth}/marketplace`,
    DATABASE_URL_TEST: `postgres://${auth}/marketplace_test`,
  })
  console.log(`  Нашёл базу: ${found.host} — записал в настройки`)
}

step('Создаю базы, если их ещё нет')
run('node', ['--env-file-if-exists=.env', 'scripts/db-create.mjs'])

step('Создаю таблицы')
run('node', ['--env-file-if-exists=.env', '--import', 'tsx', 'src/db/migrate.ts'])

console.log(`
=====================================================
  Готово. Теперь запустите файл start.bat
=====================================================

Он соберёт приложение и откроет его на http://localhost:3000

Письма никуда не отправляются: они печатаются в том же окне,
и код подтверждения при регистрации виден там же.`)

// ─── Мелочи ─────────────────────────────────────────────────────────────

function step(title) {
  console.log(`\n${title}...`)
}

function readEnv() {
  const values = {}
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/u.exec(line.trim())
    if (match) values[match[1]] = match[2].trim()
  }
  return values
}

/** Переписать значения в .env, сохранив всё остальное — включая комментарии. */
function patchEnv(values) {
  let text = readFileSync('.env', 'utf8')
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`
    const pattern = new RegExp(`^${key}=.*$`, 'mu')
    text = pattern.test(text) ? text.replace(pattern, line) : `${text}\n${line}\n`
  }
  writeFileSync('.env', text)
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) {
    fail('Полный текст ошибки — выше.', 'Если непонятно, что он означает, пришлите его мне целиком.')
  }
}

function fail(...lines) {
  console.error('\n=====================================================')
  console.error('  Не получилось')
  console.error('=====================================================\n')
  for (const line of lines) console.error(line)
  process.exit(1)
}

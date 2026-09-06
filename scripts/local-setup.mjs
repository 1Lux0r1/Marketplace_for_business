/**
 * Первая настройка на своей машине: подготовить `.env`, создать базы,
 * накатить структуру.
 *
 * Пишется отдельным скриптом, а не строчками в bat-файле, по двум причинам:
 * его можно проверить на любой системе, и он объясняет по-человечески, что
 * пошло не так, — а bat-файл в такой же ситуации показывает код ошибки.
 *
 * Повторный запуск безопасен: готовый `.env` не переписывается, существующие
 * базы не трогаются, уже накатанные изменения структуры не повторяются.
 */
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'

const NODE_MINIMUM = 22

step('Проверяю Node.js')
const major = Number(process.versions.node.split('.')[0])
if (major < NODE_MINIMUM) {
  fail(
    `Нужен Node.js ${NODE_MINIMUM} или новее, а установлен ${process.versions.node}.`,
    'Скачать: https://nodejs.org — берите версию LTS.',
  )
}
console.log(`  Node.js ${process.versions.node} — подходит`)

step('Проверяю файл настроек .env')
if (existsSync('.env')) {
  console.log('  Файл уже есть — оставляю как есть')
} else {
  if (!existsSync('.env.example')) fail('Не нашёл .env.example — видимо, репозиторий скачан не целиком.')
  copyFileSync('.env.example', '.env')

  let env = readFileSync('.env', 'utf8')
  // Ключ подписи сессий: без него приложение не стартует, а придумывать
  // его руками человек не должен
  env = env.replace(/^SESSION_SECRET=.*$/mu, `SESSION_SECRET=${randomBytes(48).toString('base64')}`)
  env = env.replace(
    /^DATABASE_URL=.*$/mu,
    'DATABASE_URL=postgres://postgres:postgres@localhost:5432/marketplace',
  )
  env = env.replace(
    /^DATABASE_URL_TEST=.*$/mu,
    'DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5432/marketplace_test',
  )
  writeFileSync('.env', env)

  console.log('  Создал .env: ключ подписи сгенерировал, адрес базы поставил обычный для своей машины')
  console.log('  Если у вашей базы другой логин или пароль — поправьте в .env строки DATABASE_URL')
}

step('Создаю базы, если их ещё нет')
run('node', ['--env-file-if-exists=.env', 'scripts/db-create.mjs'], [
  'Не получилось подключиться к базе.',
  'Проверьте два места: PostgreSQL запущен в панели, и логин с паролем',
  'в .env совпадают с теми, что панель показывает в настройках модуля.',
])

step('Накатываю структуру базы')
run('node', ['--env-file-if-exists=.env', '--import', 'tsx', 'src/db/migrate.ts'], [
  'Структура не накатилась. Полный текст ошибки — выше.',
])

console.log(`
Готово. Дальше:

  pnpm build     собрать приложение (нужно один раз после каждого обновления)
  pnpm start     запустить — откроется на http://localhost:3000

Письма никуда не уходят: они пишутся в окно, где запущено приложение,
и код подтверждения виден там же. Это ожидаемо, см. docs/13-local-server.md.`)

// ─── Мелочи ─────────────────────────────────────────────────────────────

function step(title) {
  console.log(`\n${title}...`)
}

function run(command, args, hints) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) fail(...hints)
}

function fail(...lines) {
  console.error(`\nНе получилось.\n`)
  for (const line of lines) console.error(line)
  process.exit(1)
}

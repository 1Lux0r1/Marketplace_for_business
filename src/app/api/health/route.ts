/**
 * Проверка живости для systemd и скрипта деплоя. Ничего не знает о базе:
 * упавшая база — это не «приложение мертво», это отдельная тревога.
 *
 * Ответ статический и содержит версию сборки: скрипт деплоя по нему видит
 * не только что сервер отвечает, но и что отвечает именно новой сборкой.
 * Статический он ещё и потому, что демо на GitHub Pages собирается без сервера.
 */
export const dynamic = 'force-static'

export function GET(): Response {
  return Response.json({
    status: 'ok',
    version: process.env.BUILD_VERSION ?? 'dev',
    builtAt: process.env.BUILD_TIME ?? null,
  })
}

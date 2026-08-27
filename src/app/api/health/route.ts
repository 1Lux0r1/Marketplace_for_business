export const dynamic = 'force-dynamic'

/**
 * Проверка живости для systemd и скрипта деплоя. Ничего не знает о базе:
 * упавшая база — это не «приложение мертво», это отдельная тревога.
 */
export function GET(): Response {
  return Response.json({
    status: 'ok',
    version: process.env.BUILD_VERSION ?? 'dev',
    at: new Date().toISOString(),
  })
}

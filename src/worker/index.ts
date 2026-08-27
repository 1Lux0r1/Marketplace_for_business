import { config } from '@/shared/config'
import { childLogger } from '@/shared/logger'
import { closeDb } from '@/shared/db'

/**
 * Процесс разбора `platform.outbox`.
 *
 * Здесь пока только каркас процесса: конфиг, лог, цикл опроса и корректная
 * остановка. Сам разбор — задача 01-3: выборка до WORKER_BATCH_SIZE записей
 * под pg_advisory_xact_lock, вызов подписчиков, отметка processed_at,
 * повтор с задержкой 5с → 30с → 5м → 30м и last_error после 10 попыток.
 *
 * Отправка писем, метрики и вызовы ИИ живут ТОЛЬКО здесь, никогда
 * в обработчике пользовательского запроса (§5).
 */

async function tick(): Promise<number> {
  // 01-3: выбрать необработанные события и вызвать подписчиков
  return 0
}

async function main(): Promise<void> {
  const cfg = config()
  const log = childLogger({ proc: 'worker' })
  log.info({ interval: cfg.WORKER_POLL_INTERVAL_MS, batch: cfg.WORKER_BATCH_SIZE }, 'воркер запущен')

  let stopping = false
  let timer: NodeJS.Timeout | undefined

  const stop = (signal: string): void => {
    if (stopping) return
    stopping = true
    log.info({ signal }, 'воркер останавливается')
    if (timer) clearTimeout(timer)
    void closeDb().finally(() => process.exit(0))
  }

  process.on('SIGTERM', () => { stop('SIGTERM') })
  process.on('SIGINT', () => { stop('SIGINT') })

  const loop = async (): Promise<void> => {
    if (stopping) return
    const started = Date.now()
    try {
      const processed = await tick()
      if (processed > 0) log.info({ processed, ms: Date.now() - started }, 'события обработаны')
    } catch (error: unknown) {
      // Ошибка одного прохода не должна ронять процесс: события подождут следующего
      log.error({ err: error }, 'проход воркера упал')
    }
    timer = setTimeout(() => { void loop() }, cfg.WORKER_POLL_INTERVAL_MS)
  }

  await loop()
}

main().catch((error: unknown) => {
  console.error('Воркер не стартовал:', error instanceof Error ? error.message : error)
  process.exit(1)
})

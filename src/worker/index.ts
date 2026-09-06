import { config } from '@/shared/config'
import { childLogger } from '@/shared/logger'
import { closeDb } from '@/shared/db'
import * as platform from '@/modules/platform'
import { dispatch, subscribedTypes } from './registry'
import { registerSubscriptions } from './subscriptions'

/**
 * Процесс разбора `platform.outbox`.
 *
 * Отправка писем, метрики и вызовы ИИ живут ТОЛЬКО здесь, никогда
 * в обработчике пользовательского запроса (§5). Человек не должен ждать
 * почтовый сервер, чтобы увидеть, что действие прошло.
 *
 * Доставка «хотя бы один раз»: воркер может успеть сделать дело и не успеть
 * отметить событие. Поэтому обработчики обязаны быть идемпотентными.
 */

/** Раз во сколько проходов писать в лог размер очереди. */
const STATS_EVERY = 12

async function main(): Promise<void> {
  const cfg = config()
  const log = childLogger({ proc: 'worker' })

  registerSubscriptions()
  log.info(
    {
      interval: cfg.WORKER_POLL_INTERVAL_MS,
      batch: cfg.WORKER_BATCH_SIZE,
      types: subscribedTypes(),
    },
    'воркер запущен',
  )

  let stopping = false
  let timer: NodeJS.Timeout | undefined
  let ticks = 0

  const stop = (signal: string): void => {
    if (stopping) return
    stopping = true
    log.info({ signal }, 'воркер останавливается')
    if (timer) clearTimeout(timer)
    void closeDb().finally(() => process.exit(0))
  }

  process.on('SIGTERM', () => { stop('SIGTERM') })
  process.on('SIGINT', () => { stop('SIGINT') })

  /**
   * Один проход: взять пачку, раздать подписчикам, отметить результат.
   *
   * Взятые события уже получили +1 к попыткам и отодвинутый срок, поэтому
   * упавший посреди прохода воркер очередь не запирает: события вернутся сами.
   */
  const tick = async (): Promise<number> => {
    const events = await platform.claimOutboxBatch(cfg.WORKER_BATCH_SIZE)
    let done = 0

    for (const event of events) {
      const started = Date.now()
      const result = await dispatch(event)
      const ms = Date.now() - started

      if (result.ok) {
        await platform.markOutboxProcessed(event.id)
        log.info({ eventId: event.id, type: event.type, ms }, 'событие обработано')
        done += 1
        continue
      }

      await platform.markOutboxFailed(event.id, event.attempts, result.error)
      const giveUp = event.attempts >= platform.OUTBOX_MAX_ATTEMPTS
      log[giveUp ? 'error' : 'warn'](
        { eventId: event.id, type: event.type, attempts: event.attempts, ms, err: result.error },
        giveUp ? 'событие отложено: попытки кончились' : 'событие не обработано, повторим',
      )
    }

    return done
  }

  const loop = async (): Promise<void> => {
    if (stopping) return
    const started = Date.now()
    try {
      const processed = await tick()
      if (processed > 0) log.info({ processed, ms: Date.now() - started }, 'события обработаны')

      // Размер очереди — редко и отдельно: по нему видно, что воркер встал,
      // даже когда он бодро крутится вхолостую
      ticks += 1
      if (ticks % STATS_EVERY === 0) {
        const stats = await platform.outboxStats()
        if (stats.pending > 0 || stats.stuck > 0) log.info(stats, 'очередь')
        if (stats.stuck > 0) log.error({ stuck: stats.stuck }, 'события, которые уже не повторятся')
      }
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

import type { OutboxEvent } from '@/modules/platform'

/**
 * Кто на что подписан.
 *
 * Реестр живёт в воркере, а не в модуле `platform`, и это не мелочь: модуль,
 * публикующий событие, не должен знать, кто на него подписан (§4.5). `deal`
 * говорит «сделка принята» — и всё; что при этом уходит письмо, знает только
 * тот, кто собирает систему вместе, то есть воркер.
 */

export type Handler = (event: OutboxEvent) => Promise<void>

const handlers = new Map<string, Handler[]>()

/** Подписаться на событие. Подписчиков у одного события может быть несколько. */
export function on(type: string, handler: Handler): void {
  const existing = handlers.get(type)
  if (existing) existing.push(handler)
  else handlers.set(type, [handler])
}

export function subscribersFor(type: string): Handler[] {
  return handlers.get(type) ?? []
}

/**
 * Вызвать всех подписчиков события.
 *
 * Один упавший подписчик не отменяет остальных: письмо не ушло — это не повод
 * не записать метрику. Поэтому ошибки собираются, а не бросаются на первой.
 *
 * Событие считается обработанным, только если справились все: иначе повтор
 * не дошёл бы до упавшего. Отсюда требование идемпотентности — при повторе
 * успешные подписчики отработают ещё раз и не должны сделать второй эффект.
 */
export async function dispatch(event: OutboxEvent): Promise<{ ok: true } | { ok: false; error: string }> {
  const subscribers = subscribersFor(event.type)
  if (subscribers.length === 0) return { ok: true }

  const results = await Promise.allSettled(subscribers.map((handler) => handler(event)))
  const failures = results
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) =>
      result.reason instanceof Error ? result.reason.message : String(result.reason),
    )

  return failures.length === 0 ? { ok: true } : { ok: false, error: failures.join('; ') }
}

/** Сбросить подписки — для тестов, чтобы они не влияли друг на друга. */
export function resetRegistry(): void {
  handlers.clear()
}

/** Какие события кто-то слушает — для лога при старте воркера. */
export function subscribedTypes(): string[] {
  return [...handlers.keys()].sort()
}

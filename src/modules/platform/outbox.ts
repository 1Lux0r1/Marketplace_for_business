import { and, asc, eq, isNull, lte, sql } from 'drizzle-orm'
import { getDb, type Executor } from '@/shared/db'
import { outbox } from './schema'

/**
 * Очередь событий.
 *
 * Правило §5: изменение данных и запись события — одна транзакция, а всё
 * остальное (письмо, метрика, вызов ИИ) делает воркер. Поэтому `publish`
 * принимает транзакцию, а не открывает свою: иначе сделка могла бы измениться
 * без события или событие появиться без сделки.
 *
 * Доставка «хотя бы один раз», а не «ровно один раз». Ровно один раз в такой
 * задаче стоит недостижимо дорого: воркер может успеть отправить письмо
 * и не успеть отметить событие. Поэтому обработчики обязаны быть
 * идемпотентными — повторный вызов не должен создавать второй эффект (§5).
 */

/** Пауза перед следующей попыткой. Дальше четвёртой — по полчаса. */
const RETRY_DELAYS_SECONDS = [5, 30, 300, 1800] as const

/** После этого числа неудач событие откладывается насовсем и ждёт человека. */
export const MAX_ATTEMPTS = 10

/**
 * Номер замка, под которым разбирается очередь. Число произвольное, важно лишь
 * что оно одно на всех: два воркера не должны разбирать одни и те же события.
 */
const LOCK_KEY = 4_717_001

export type PublishInput = {
  type: string
  aggregate: string
  aggregateId: string
  payload: Record<string, unknown>
}

export type OutboxEvent = {
  id: number
  type: string
  aggregate: string
  aggregateId: string
  payload: Record<string, unknown>
  attempts: number
  occurredAt: Date
}

/**
 * Записать событие в ту же транзакцию, в которой менялись данные.
 *
 * Транзакция обязательна и передаётся явно. Если её откатят, события
 * не останется — это и есть весь смысл механизма.
 */
export async function publish(tx: Executor, input: PublishInput): Promise<void> {
  await tx.insert(outbox).values({
    type: input.type,
    aggregate: input.aggregate,
    aggregateId: input.aggregateId,
    payload: input.payload,
  })
}

/**
 * Взять пачку событий в работу.
 *
 * Замок держится только на время выборки, а не на время обработки: письмо
 * может идти секунды, и всё это время держать замок нельзя — второй воркер
 * стоял бы без дела, а при падении первого очередь замерла бы до перезапуска.
 *
 * Взятые события сразу получают +1 к попыткам и отодвинутый `available_at`.
 * Поэтому воркер, упавший посреди обработки, не блокирует очередь: события
 * вернутся сами, когда истечёт задержка.
 */
export async function claimBatch(limit: number): Promise<OutboxEvent[]> {
  const db = getDb()

  return db.transaction(async (tx) => {
    // Замок на уровне транзакции: снимется сам при коммите или откате,
    // в том числе если процесс убьют
    const [lock] = await tx.execute<{ locked: boolean }>(
      sql`select pg_try_advisory_xact_lock(${LOCK_KEY}) as locked`,
    )
    if (!lock?.locked) return []

    const rows = await tx
      .select()
      .from(outbox)
      .where(
        and(
          isNull(outbox.processedAt),
          lte(outbox.availableAt, sql`now()`),
          sql`${outbox.attempts} < ${MAX_ATTEMPTS}`,
        ),
      )
      .orderBy(asc(outbox.id))
      .limit(limit)

    if (rows.length === 0) return []

    const ids = rows.map((row) => row.id)
    await tx
      .update(outbox)
      .set({
        attempts: sql`${outbox.attempts} + 1`,
        // Отодвигаем сразу: если обработка не завершится, событие вернётся
        // не раньше этого срока, а не в следующую же секунду
        availableAt: sql`now() + ${retryInterval(1)}`,
      })
      .where(sql`${outbox.id} in ${ids}`)

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      aggregate: row.aggregate,
      aggregateId: row.aggregateId,
      payload: row.payload as Record<string, unknown>,
      attempts: row.attempts + 1,
      occurredAt: row.occurredAt,
    }))
  })
}

/** Событие обработано: больше его не возьмут. */
export async function markProcessed(id: number): Promise<void> {
  const db = getDb()
  await db
    .update(outbox)
    .set({ processedAt: new Date(), lastError: null })
    .where(eq(outbox.id, id))
}

/**
 * Обработчик не справился. Событие вернётся через паузу, растущую с каждой
 * неудачей, а после `MAX_ATTEMPTS` перестанет возвращаться совсем — иначе
 * одно битое событие будет вечно занимать место в каждой пачке.
 */
export async function markFailed(id: number, attempts: number, error: string): Promise<void> {
  const db = getDb()
  await db
    .update(outbox)
    .set({
      lastError: error.slice(0, 2000),
      availableAt: sql`now() + ${retryInterval(attempts)}`,
    })
    .where(eq(outbox.id, id))
}

/**
 * Сколько работы стоит в очереди и насколько она застоялась.
 *
 * Возраст самого старого необработанного события — главный признак того,
 * что воркер встал: количество может быть небольшим и при этом висеть часами.
 */
export async function outboxStats(): Promise<{
  pending: number
  stuck: number
  oldestSeconds: number | null
}> {
  const db = getDb()
  const [row] = await db.execute<{
    pending: string
    stuck: string
    oldest_seconds: number | null
  }>(sql`
    select
      count(*) filter (where processed_at is null and attempts < ${MAX_ATTEMPTS}) as pending,
      count(*) filter (where processed_at is null and attempts >= ${MAX_ATTEMPTS}) as stuck,
      extract(epoch from now() - min(occurred_at) filter (where processed_at is null))::int
        as oldest_seconds
    from platform.outbox`)

  return {
    pending: Number(row?.pending ?? 0),
    stuck: Number(row?.stuck ?? 0),
    oldestSeconds: row?.oldest_seconds ?? null,
  }
}

/** Пауза перед попыткой номер `attempts`, в виде интервала для базы. */
function retryInterval(attempts: number) {
  const index = Math.min(Math.max(attempts, 1), RETRY_DELAYS_SECONDS.length) - 1
  const seconds = RETRY_DELAYS_SECONDS[index] ?? RETRY_DELAYS_SECONDS.at(-1) ?? 1800
  return sql.raw(`interval '${seconds} seconds'`)
}

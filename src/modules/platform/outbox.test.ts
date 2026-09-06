import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { closeDb, getDb } from '@/shared/db'
import * as platform from './index'
import { outbox } from './schema'

/**
 * На этот механизм ляжет вся система, поэтому проверяется не «работает ли
 * в хорошем случае», а поведение в плохих: откат транзакции, падение
 * подписчика, повторная доставка, смерть воркера посреди обработки.
 */

beforeEach(async () => {
  const db = getDb()
  await db.execute(sql`truncate platform.orgs, platform.outbox restart identity cascade`)
})

afterAll(async () => {
  await closeDb()
})

const event = {
  type: 'deal.accepted',
  aggregate: 'deal',
  aggregateId: '01a07261-0000-7000-8000-000000000001',
  payload: { priceKopecks: 1500000 },
}

async function publishOne(overrides: Partial<typeof event> = {}) {
  const db = getDb()
  await db.transaction(async (tx) => {
    await platform.publish(tx, { ...event, ...overrides })
  })
}

describe('публикация', () => {
  it('событие живёт в той же транзакции, что и данные', async () => {
    await publishOne()
    const [claimed] = await platform.claimOutboxBatch(10)
    expect(claimed?.type).toBe('deal.accepted')
    expect(claimed?.payload).toEqual({ priceKopecks: 1500000 })
  })

  it('откат транзакции уносит событие с собой', async () => {
    const db = getDb()
    await expect(
      db.transaction(async (tx) => {
        await platform.publish(tx, event)
        // Что-то пошло не так уже после публикации
        throw new Error('передумали')
      }),
    ).rejects.toThrow('передумали')

    // Иначе система обещала бы то, чего не произошло: письмо о сделке,
    // которой нет
    expect(await platform.claimOutboxBatch(10)).toHaveLength(0)
  })

  it('регистрация компании публикует событие и не кладёт в него код', async () => {
    const { orgId, emailCode } = await platform.register({
      legalForm: 'company',
      companyName: 'Кофейня «Пример»',
      inn: '7701234567',
      fullName: 'Анна Ковалёва',
      email: 'anna@example.ru',
      phone: '+79161234567',
      password: 'корова лошадь батарейка',
    })

    const [claimed] = await platform.claimOutboxBatch(10)
    expect(claimed?.type).toBe('user.registered')
    expect(claimed?.aggregateId).toBe(orgId)

    // Содержимое события лежит в базе открытым текстом, а код — это вход
    expect(JSON.stringify(claimed?.payload)).not.toContain(emailCode)
  })
})

describe('выборка в работу', () => {
  it('порядок обработки совпадает с порядком записи', async () => {
    await publishOne({ type: 'первое' })
    await publishOne({ type: 'второе' })
    await publishOne({ type: 'третье' })

    const claimed = await platform.claimOutboxBatch(10)
    expect(claimed.map((e) => e.type)).toEqual(['первое', 'второе', 'третье'])
  })

  it('взятое в работу не выдаётся второй раз подряд', async () => {
    await publishOne()
    expect(await platform.claimOutboxBatch(10)).toHaveLength(1)

    // Иначе два прохода воркера обработали бы одно событие дважды
    expect(await platform.claimOutboxBatch(10)).toHaveLength(0)
  })

  it('обработанное не возвращается никогда', async () => {
    await publishOne()
    const [claimed] = await platform.claimOutboxBatch(10)
    await platform.markOutboxProcessed(claimed!.id)

    const db = getDb()
    await db.execute(sql`update platform.outbox set available_at = now() - interval '1 hour'`)
    expect(await platform.claimOutboxBatch(10)).toHaveLength(0)
  })

  it('берёт не больше, чем просили', async () => {
    for (let i = 0; i < 5; i += 1) await publishOne()
    expect(await platform.claimOutboxBatch(2)).toHaveLength(2)
  })
})

describe('повторы', () => {
  it('после неудачи событие возвращается, но не сразу', async () => {
    await publishOne()
    const [claimed] = await platform.claimOutboxBatch(10)
    await platform.markOutboxFailed(claimed!.id, claimed!.attempts, 'почта не ответила')

    // Сразу — нет: иначе десять попыток сгорели бы за секунду
    expect(await platform.claimOutboxBatch(10)).toHaveLength(0)

    const db = getDb()
    await db.execute(sql`update platform.outbox set available_at = now() - interval '1 second'`)
    const again = await platform.claimOutboxBatch(10)
    expect(again).toHaveLength(1)
    expect(again[0]?.attempts).toBe(2)
  })

  it('падение воркера посреди обработки не запирает очередь', async () => {
    await publishOne()
    // Взяли в работу и умерли, ничего не отметив
    await platform.claimOutboxBatch(10)

    const db = getDb()
    await db.execute(sql`update platform.outbox set available_at = now() - interval '1 second'`)

    // Событие вернулось само, без вмешательства человека
    expect(await platform.claimOutboxBatch(10)).toHaveLength(1)
  })

  it('после десяти неудач событие перестаёт возвращаться', async () => {
    await publishOne()
    const db = getDb()
    await db.execute(sql`
      update platform.outbox
      set attempts = ${platform.OUTBOX_MAX_ATTEMPTS},
          available_at = now() - interval '1 hour',
          last_error = 'почта не ответила'`)

    // Иначе одно битое событие вечно занимало бы место в каждой пачке
    expect(await platform.claimOutboxBatch(10)).toHaveLength(0)

    const stats = await platform.outboxStats()
    expect(stats.stuck).toBe(1)
    expect(stats.pending).toBe(0)
  })

  it('причина неудачи сохраняется — по ней разбираются потом', async () => {
    await publishOne()
    const [claimed] = await platform.claimOutboxBatch(10)
    await platform.markOutboxFailed(claimed!.id, claimed!.attempts, 'почтовый сервер не ответил')

    const db = getDb()
    const [row] = await db.select().from(outbox)
    expect(row?.lastError).toBe('почтовый сервер не ответил')
  })
})

describe('размер очереди', () => {
  it('показывает, сколько ждёт и насколько застоялось', async () => {
    await publishOne()
    await publishOne()

    const db = getDb()
    await db.execute(sql`update platform.outbox set occurred_at = now() - interval '10 minutes'`)

    const stats = await platform.outboxStats()
    expect(stats.pending).toBe(2)
    // Возраст самого старого — главный признак, что воркер встал:
    // событий может быть мало, а висеть они могут часами
    expect(stats.oldestSeconds).toBeGreaterThanOrEqual(600)
  })

  it('на пустой очереди не выдумывает возраст', async () => {
    const stats = await platform.outboxStats()
    expect(stats).toEqual({ pending: 0, stuck: 0, oldestSeconds: null })
  })
})

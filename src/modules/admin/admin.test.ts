import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { closeDb, getDb } from '@/shared/db'
import * as admin from './index'
import { AdminError } from './errors'

/**
 * Журнал изменений. На нём держится доверие к площадке, поэтому проверяется
 * не «пишется ли запись», а три свойства, без которых он бесполезен:
 * не врёт при откате, хранит оба значения и не редактируется.
 */

const actor = { id: '01a00000-0000-7000-8000-00000000000a', fullName: 'Мария Зайцева', role: 'admin' }
const target = '01a00000-0000-7000-8000-0000000000ff'

beforeEach(async () => {
  await getDb().execute(sql`truncate admin.audit_log`)
})

afterAll(async () => {
  await closeDb()
})

async function rejection(promise: Promise<unknown>): Promise<AdminError> {
  try {
    await promise
  } catch (error: unknown) {
    if (error instanceof AdminError) return error
    throw error
  }
  throw new Error('Ожидался отказ, но вызов прошёл успешно')
}

describe('журнал изменений', () => {
  /**
   * Критерий приёмки задачи 03-1. Журнал, который переживает откат, хуже
   * отсутствия журнала: он утверждает, что изменение было, а его не было.
   */
  it('откат транзакции не оставляет записи', async () => {
    const db = getDb()

    await expect(
      db.transaction(async (tx) => {
        await admin.logChange(tx, {
          actor,
          action: 'rate.changed',
          entity: 'payments.rate',
          entityId: target,
          before: { percent: 10 },
          after: { percent: 12 },
        })
        // Что-то пошло не так уже после записи в журнал — так и бывает:
        // журнал пишут рядом с изменением, а падает изменение
        throw new Error('изменение не удалось')
      }),
    ).rejects.toThrow('изменение не удалось')

    expect((await admin.listChanges()).total).toBe(0)
  })

  it('удачная транзакция запись оставляет', async () => {
    const db = getDb()
    await db.transaction(async (tx) => {
      await admin.logChange(tx, {
        actor,
        action: 'rate.changed',
        entity: 'payments.rate',
        entityId: target,
        before: { percent: 10 },
        after: { percent: 12 },
      })
    })
    expect((await admin.listChanges()).total).toBe(1)
  })

  /** «Ставка изменена» не отвечает ни на один вопрос. «Было 10, стало 12» — отвечает. */
  it('хранит старое значение и новое, а не факт изменения', async () => {
    await admin.logChange(getDb(), {
      actor,
      action: 'rate.changed',
      entity: 'payments.rate',
      entityId: target,
      entityLabel: 'Санобработка, Москва',
      before: { percentBasisPoints: 1000 },
      after: { percentBasisPoints: 1200 },
      reason: 'Договорились с подрядчиком на пилот',
    })

    const [change] = (await admin.listChanges()).items
    expect(change?.before).toEqual({ percentBasisPoints: 1000 })
    expect(change?.after).toEqual({ percentBasisPoints: 1200 })
    expect(change?.entityLabel).toBe('Санобработка, Москва')
    expect(change?.reason).toBe('Договорились с подрядчиком на пилот')
  })

  /**
   * Человека переименуют, уволят, отзовут ему доступ — а журнал обязан
   * читаться через год. Поэтому имя снимком, а не ссылкой на учётную запись.
   */
  it('имя и роль автора хранит снимком', async () => {
    await admin.logChange(getDb(), {
      actor,
      action: 'org.blocked',
      entity: 'platform.org',
      entityId: target,
    })
    const [change] = (await admin.listChanges()).items
    expect(change?.actorName).toBe('Мария Зайцева')
    expect(change?.actorRole).toBe('admin')
  })

  /**
   * Журнал, который можно поправить, не журнал. Проверяем не интерфейс,
   * а сам модуль: править нечем, потому что такой команды нет.
   */
  it('не даёт ни изменить запись, ни удалить', () => {
    const surface = Object.keys(admin)
    expect(surface.filter((name) => /update|edit|delete|remove|clear/iu.test(name))).toEqual([])
  })

  it('показывает последнее первым', async () => {
    for (const action of ['первое', 'второе', 'третье']) {
      await admin.logChange(getDb(), { actor, action, entity: 'platform.org', entityId: target })
    }
    expect((await admin.listChanges()).items.map((c) => c.action)).toEqual([
      'третье',
      'второе',
      'первое',
    ])
  })

  it('сужает журнал по тому, над чем работали', async () => {
    const other = '01a00000-0000-7000-8000-0000000000ee'
    await admin.logChange(getDb(), { actor, action: 'a', entity: 'platform.org', entityId: target })
    await admin.logChange(getDb(), { actor, action: 'b', entity: 'catalog.contractor', entityId: other })

    const page = await admin.listChanges({ entity: 'catalog.contractor' })
    expect(page.total).toBe(1)
    expect(page.items[0]?.action).toBe('b')
  })

  it('отдаёт одну запись по идентификатору и отказывает на несуществующую', async () => {
    await admin.logChange(getDb(), { actor, action: 'a', entity: 'platform.org', entityId: target })
    const [change] = (await admin.listChanges()).items
    expect((await admin.getChange(change!.id)).action).toBe('a')

    const missing = '01a00000-0000-7000-8000-000000000001'
    expect((await rejection(admin.getChange(missing))).code).toBe('change_not_found')
  })

  it('не принимает запись без действия', async () => {
    const error = await rejection(
      admin.logChange(getDb(), { actor, action: '  ', entity: 'platform.org', entityId: target }),
    )
    expect(error.code).toBe('bad_change')
  })

  /**
   * Постранично журнал читают редко, но читают: «что было в прошлый вторник».
   * Верхняя граница — чтобы одним запросом нельзя было вытянуть всё.
   */
  it('отдаёт страницами и не больше двухсот за раз', async () => {
    for (let i = 0; i < 5; i += 1) {
      await admin.logChange(getDb(), {
        actor,
        action: `шаг ${i}`,
        entity: 'platform.org',
        entityId: target,
      })
    }
    const page = await admin.listChanges({ limit: 2, offset: 2 })
    expect(page.items.map((c) => c.action)).toEqual(['шаг 2', 'шаг 1'])
    expect(page.total).toBe(5)

    expect((await admin.listChanges({ limit: 9999 })).items.length).toBeLessThanOrEqual(200)
  })
})

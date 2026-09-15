import { readFileSync } from 'node:fs'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { closeDb, getDb } from '@/shared/db'
import * as platform from '@/modules/platform'
import * as intake from './index'
import { IntakeError } from './errors'

/**
 * Приём заявки. Проверяется то, где ошибка тихая: заявка без события,
 * событие без заявки, чужая заявка, зона из воздуха.
 */

async function rejection(promise: Promise<unknown>): Promise<IntakeError> {
  try {
    await promise
  } catch (error: unknown) {
    if (error instanceof IntakeError) return error
    throw error
  }
  throw new Error('Ожидался отказ, но вызов прошёл успешно')
}

beforeEach(async () => {
  const db = getDb()
  await db.execute(sql`truncate intake.requests, platform.orgs, platform.outbox cascade`)
  // Счётчик попыток отправки кода — общий на всю базу: без сброса каждый
  // следующий тест упирается в «слишком много попыток»
  await db.execute(
    sql`truncate platform.login_attempts, platform.login_tokens restart identity cascade`,
  )
})

afterAll(async () => {
  await closeDb()
})

const registration = {
  legalForm: 'company' as const,
  companyName: 'Кофейня «Пример»',
  inn: '7701234560',
  fullName: 'Анна Ковалёва',
  position: 'Директор',
  email: 'anna@example.ru',
  phone: '+7 916 123-45-67',
  password: 'корова лошадь батарейка',
}

async function clientWithSite(over: Partial<typeof registration> = {}) {
  const input = { ...registration, ...over }
  const { userId, orgId, emailCode } = await platform.register(input)
  await platform.verifyEmail({ email: input.email, code: emailCode })
  const actor = await platform.getUser(userId)
  const site = await platform.addSite({
    actor,
    orgId,
    name: 'Кофейня на Тверской',
    address: 'Москва, Тверская 12',
    zoneCode: 'msk-cao',
    contactName: 'Ирина',
    contactPhone: '+7 916 111-22-33',
  })
  return { actor, orgId, site }
}

const task = 'Нужна санобработка от тараканов на кухне, желательно ночью'

describe('приём заявки', () => {
  it('клиент оставляет заявку и получает номер, который можно назвать вслух', async () => {
    const { actor, site } = await clientWithSite()
    const request = await intake.createRequest({ actor, siteId: site.id, rawText: task })

    expect(request.number).toBeGreaterThanOrEqual(1000)
    expect(request.status).toBe('new')
    expect(request.rawText).toBe(task)
  })

  /**
   * Критерий приёмки 03-5: заявка и событие о ней — одна транзакция (§5).
   *
   * Ломаем очередь, а не заявку, и это важно. Если ломать запись заявки,
   * до публикации события дело просто не дойдёт, и тест пройдёт, ничего
   * не проверив. А вот сбой НА публикации, уже после записи заявки, отвечает
   * на настоящий вопрос: одна это транзакция или две. Если две — заявка
   * останется в базе, и о ней никто никогда не узнает.
   */
  it('сбой при публикации события не оставляет заявку без события', async () => {
    const { actor, site } = await clientWithSite()
    const db = getDb()

    await db.execute(sql`alter table platform.outbox add constraint tmp_fail check (false) not valid`)
    try {
      await expect(
        intake.createRequest({ actor, siteId: site.id, rawText: task }),
      ).rejects.toThrow()
    } finally {
      await db.execute(sql`alter table platform.outbox drop constraint tmp_fail`)
    }

    // Заявки нет: раз событие не записалось, не должно остаться и её
    const [left] = await db.execute<{ count: number }>(
      sql`select count(*)::int as count from intake.requests`,
    )
    expect(left?.count).toBe(0)
  })

  /**
   * А это — проверка того же правила с другой стороны, и она здесь потому,
   * что поведением его до конца не проверить.
   *
   * Если событие опубликовать МИМО транзакции, оба теста выше всё равно
   * пройдут: в этом пути после публикации ничего не падает, и разницы
   * не видно. Увидеть её можно будет позже, когда после публикации появится
   * ещё один шаг, — то есть тогда, когда ошибку уже выложат.
   *
   * Поэтому смотрим на сам вызов. Проверка грубая, но ловит ровно ту ошибку,
   * которая здесь возможна: `publish(getDb())` вместо `publish(tx)`.
   */
  it('событие публикуется транзакцией заявки, а не мимо неё', async () => {
    const source = readFileSync(new URL('./service.ts', import.meta.url), 'utf8')
    const calls = [...source.matchAll(/platform\.publish\(\s*([A-Za-z_$][\w$]*)/gu)]

    expect(calls.length, 'вызов publish не найден — тест смотрит не туда').toBeGreaterThan(0)
    for (const call of calls) {
      expect(call[1], 'событие должно публиковаться транзакцией вызова (§5)').toBe('tx')
    }
  })

  it('сбой при записи заявки не оставляет события в очереди', async () => {
    const { actor, site } = await clientWithSite()
    const db = getDb()

    await db.execute(sql`alter table intake.requests add constraint tmp_fail check (false) not valid`)
    try {
      await expect(
        intake.createRequest({ actor, siteId: site.id, rawText: task }),
      ).rejects.toThrow()
    } finally {
      await db.execute(sql`alter table intake.requests drop constraint tmp_fail`)
    }

    const [pending] = await db.execute<{ count: number }>(
      sql`select count(*)::int as count from platform.outbox where type = 'request.created'`,
    )
    expect(pending?.count).toBe(0)
  })

  it('удачная заявка кладёт в очередь ровно одно событие', async () => {
    const { actor, site } = await clientWithSite()
    const request = await intake.createRequest({ actor, siteId: site.id, rawText: task })

    const rows = await getDb().execute<{ payload: Record<string, unknown> }>(
      sql`select payload from platform.outbox where type = 'request.created'`,
    )
    expect(rows.length).toBe(1)
    expect(rows[0]?.payload).toMatchObject({ requestId: request.id, zoneCode: 'msk-cao' })
  })

  /**
   * В очереди полезная нагрузка лежит открытым текстом. Персональным данным
   * там не место, и подписчикам они не нужны: подбор идёт по зоне и категории.
   */
  it('в событие не попадают ни имя, ни телефон клиента', async () => {
    const { actor, site } = await clientWithSite()
    await intake.createRequest({
      actor,
      siteId: site.id,
      rawText: task,
      contactName: 'Ирина Петрова',
      contactPhone: '+7 916 111-22-33',
    })

    const rows = await getDb().execute<{ payload: Record<string, unknown> }>(
      sql`select payload from platform.outbox where type = 'request.created'`,
    )
    const text = JSON.stringify(rows[0]?.payload)
    expect(text).not.toContain('Ирина')
    expect(text).not.toContain('9161112233')
    // И самого текста заявки тоже: клиент мог написать там что угодно
    expect(text).not.toContain('тараканов')
  })

  /** Зона — из точки, и руками её не вводят: опечатка обнулила бы подбор. */
  it('зону и адрес берёт из точки, а не из формы', async () => {
    const { actor, site } = await clientWithSite()
    const request = await intake.createRequest({ actor, siteId: site.id, rawText: task })

    expect(request.zoneCode).toBe('msk-cao')
    expect(request.address).toBe(site.address)
  })

  /**
   * Точку переименуют, перенесут или уберут, а заявка обязана помнить,
   * куда именно ехали.
   */
  it('адрес хранит снимком: правка точки старую заявку не меняет', async () => {
    const { actor, site } = await clientWithSite()
    const request = await intake.createRequest({ actor, siteId: site.id, rawText: task })

    await platform.updateSite({
      actor,
      siteId: site.id,
      name: site.name,
      address: 'Москва, совсем другой адрес 99',
      zoneCode: 'msk-zao',
    })

    const again = await intake.getRequest(actor, request.id)
    expect(again.address).toBe('Москва, Тверская 12')
    expect(again.zoneCode).toBe('msk-cao')
  })

  /**
   * Отказ приходит из `platform.getSite`, а не отсюда, и это правильно:
   * проверка владельца стоит у владельца данных. `intake` её не повторяет —
   * повтор означал бы два места, где её можно забыть обновить.
   */
  it('не принимает заявку на чужую точку', async () => {
    const first = await clientWithSite()
    const other = await clientWithSite({
      companyName: 'Салон «Второй»',
      inn: '7707083893',
      email: 'boris@example.ru',
      phone: '+7 916 000-00-02',
      fullName: 'Борис Орлов',
    })

    await expect(
      intake.createRequest({ actor: other.actor, siteId: first.site.id, rawText: task }),
    ).rejects.toMatchObject({ code: 'forbidden' })

    // И заявка не завелась
    expect((await intake.listRequests(other.actor)).total).toBe(0)
  })

  it('не принимает пустое описание', async () => {
    const { actor, site } = await clientWithSite()
    const error = await rejection(
      intake.createRequest({ actor, siteId: site.id, rawText: 'ну надо' }),
    )
    expect(error.code).toBe('bad_request')
  })

  it('не принимает заявку на убранную точку', async () => {
    const { actor, site } = await clientWithSite()
    await platform.archiveSite(actor, site.id)

    const error = await rejection(
      intake.createRequest({ actor, siteId: site.id, rawText: task }),
    )
    expect(error.code).toBe('bad_request')
  })

  /**
   * Цифра «насколько модель лучше правил» нужна в отчёте по гранту,
   * и собирать её надо с первой заявки, а не когда понадобится.
   */
  it('отмечает, что заявку разбирает человек, и оставляет место под ИИ', async () => {
    const { actor, site } = await clientWithSite()
    const request = await intake.createRequest({ actor, siteId: site.id, rawText: task })

    expect(request.parseSource).toBe('operator')
    expect(request.parseMeta).toEqual({})
  })
})

describe('кто какие заявки видит', () => {
  it('клиент не видит чужую заявку даже с идентификатором', async () => {
    const first = await clientWithSite()
    const other = await clientWithSite({
      companyName: 'Салон «Второй»',
      inn: '7707083893',
      email: 'boris@example.ru',
      phone: '+7 916 000-00-02',
      fullName: 'Борис Орлов',
    })

    const request = await intake.createRequest({
      actor: first.actor,
      siteId: first.site.id,
      rawText: task,
    })

    expect((await rejection(intake.getRequest(other.actor, request.id))).code).toBe('forbidden')
  })

  it('на несуществующую заявку отвечает «не найдено», а не «нет прав»', async () => {
    const { actor } = await clientWithSite()
    const missing = '01a00000-0000-7000-8000-000000000000'
    expect((await rejection(intake.getRequest(actor, missing))).code).toBe('request_not_found')
  })

  it('в своём списке клиент видит только свои заявки', async () => {
    const first = await clientWithSite()
    const other = await clientWithSite({
      companyName: 'Салон «Второй»',
      inn: '7707083893',
      email: 'boris@example.ru',
      phone: '+7 916 000-00-02',
      fullName: 'Борис Орлов',
    })

    await intake.createRequest({ actor: first.actor, siteId: first.site.id, rawText: task })
    await intake.createRequest({ actor: other.actor, siteId: other.site.id, rawText: task })

    const mine = await intake.listRequests(first.actor)
    expect(mine.total).toBe(1)
    expect(mine.items[0]?.clientOrgId).toBe(first.orgId)
  })

  it('клиент не может запросить список чужой компании', async () => {
    const first = await clientWithSite()
    const other = await clientWithSite({
      companyName: 'Салон «Второй»',
      inn: '7707083893',
      email: 'boris@example.ru',
      phone: '+7 916 000-00-02',
      fullName: 'Борис Орлов',
    })

    const error = await rejection(
      intake.listRequests(other.actor, { clientOrgId: first.orgId }),
    )
    expect(error.code).toBe('forbidden')
  })

  it('оператор видит очередь всех заявок', async () => {
    const first = await clientWithSite()
    const other = await clientWithSite({
      companyName: 'Салон «Второй»',
      inn: '7707083893',
      email: 'boris@example.ru',
      phone: '+7 916 000-00-02',
      fullName: 'Борис Орлов',
    })
    await intake.createRequest({ actor: first.actor, siteId: first.site.id, rawText: task })
    await intake.createRequest({ actor: other.actor, siteId: other.site.id, rawText: task })

    const operator = { orgId: 'платформа', role: 'operator' as const }
    expect((await intake.listRequests(operator)).total).toBe(2)
  })

  it('история заявки закрыта теми же правами, что и сама заявка', async () => {
    const first = await clientWithSite()
    const other = await clientWithSite({
      companyName: 'Салон «Второй»',
      inn: '7707083893',
      email: 'boris@example.ru',
      phone: '+7 916 000-00-02',
      fullName: 'Борис Орлов',
    })
    const request = await intake.createRequest({
      actor: first.actor,
      siteId: first.site.id,
      rawText: task,
    })

    expect((await intake.requestHistory(first.actor, request.id)).map((e) => e.type)).toEqual([
      'created',
    ])
    expect((await rejection(intake.requestHistory(other.actor, request.id))).code).toBe('forbidden')
  })
})

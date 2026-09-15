import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { closeDb, getDb } from '@/shared/db'
import * as platform from '@/modules/platform'
import * as catalog from '@/modules/catalog'
import * as deal from './index'
import { DealError } from './errors'

/**
 * Сделка на живой базе. §8 требует тестов на переходы статусов и права
 * доступа; таблица переходов проверена отдельно в `statuses.test.ts`,
 * здесь — что код ей действительно следует, а не проверяет по-своему.
 */

async function rejection(promise: Promise<unknown>): Promise<DealError> {
  try {
    await promise
  } catch (error: unknown) {
    if (error instanceof DealError) return error
    throw error
  }
  throw new Error('Ожидался отказ, но вызов прошёл успешно')
}

beforeEach(async () => {
  const db = getDb()
  await db.execute(sql`truncate deal.deals cascade`)
  await db.execute(sql`truncate catalog.contractors, catalog.categories cascade`)
  await db.execute(sql`truncate platform.orgs, platform.outbox restart identity cascade`)
  await db.execute(
    sql`truncate platform.login_attempts, platform.login_tokens restart identity cascade`,
  )
})

afterAll(async () => {
  await closeDb()
})

const client = {
  legalForm: 'company' as const,
  companyName: 'Кофейня «Пример»',
  inn: '7701234560',
  fullName: 'Анна Ковалёва',
  position: 'Директор',
  email: 'anna@example.ru',
  phone: '+7 916 123-45-67',
  password: 'корова лошадь батарейка',
}

async function makeClient(over: Partial<typeof client> = {}) {
  const input = { ...client, ...over }
  const { userId, orgId, emailCode } = await platform.register(input)
  await platform.verifyEmail({ email: input.email, code: emailCode })
  const actor = await platform.getUser(userId)
  const site = await platform.addSite({
    actor,
    orgId,
    name: 'Кофейня на Тверской',
    address: 'Москва, Тверская 12',
    zoneCode: 'msk-cao',
  })
  return { actor, orgId, site }
}

/** Опубликованная карточка за 5000 ₽ — то, что клиент может заказать. */
async function makeListing(priceKopecks = 500_000n) {
  const { orgId } = await platform.register({
    legalForm: 'company',
    companyName: 'СанПро',
    inn: '7707083893',
    fullName: 'Борис Орлов',
    email: 'boris@example.ru',
    phone: '+7 916 000-00-02',
    password: 'корова лошадь батарейка',
  })
  const contractor = await catalog.createContractor({ orgId, status: 'active' })
  // Категорию заводим запросом: команды на это у каталога нет — категории
  // приходят сидом и справочником администратора, а не кодом соседей
  const [category] = await getDb().execute<{ id: string }>(sql`
    insert into catalog.categories (id, code, name, kind)
    values (gen_random_uuid(), 'sanitation', 'Санобработка', 'service') returning id`)
  const listing = await catalog.createListing({
    contractorId: contractor.id,
    categoryId: category!.id,
    title: 'Санобработка кухни',
    unit: 'объект',
    priceKopecks,
    minQty: '1',
    status: 'published',
  })
  await catalog.setContractorZones(contractor.id, ['msk'])
  return { listing, contractor, orgId }
}

const operator = {
  id: '01a00000-0000-7000-8000-0000000000aa',
  orgId: '01a00000-0000-7000-8000-0000000000bb',
  role: 'operator' as const,
  fullName: 'Оператор Тестов',
}

describe('заказ из каталога — основной путь клиента (§1)', () => {
  it('клиент заказывает услугу и получает сделку с номером', async () => {
    const { actor, site } = await makeClient()
    const { listing, contractor } = await makeListing()

    const made = await deal.createFromListing({
      actor,
      listingId: listing.id,
      siteId: site.id,
    })

    expect(made.number).toBeGreaterThanOrEqual(1000)
    expect(made.status).toBe('new')
    expect(made.source).toBe('catalog')
    expect(made.contractorId).toBe(contractor.id)
  })

  /**
   * Цена в карточке — оферта подрядчика на сегодня. Он вправе изменить её
   * завтра, и это не должно менять уже заключённую сделку.
   */
  it('цену копирует снимком: правка карточки старую сделку не трогает', async () => {
    const { actor, site } = await makeClient()
    const { listing } = await makeListing(500_000n)

    const made = await deal.createFromListing({ actor, listingId: listing.id, siteId: site.id })
    expect(made.priceKopecks).toBe(500_000n)

    // Подрядчик поднял цену в карточке
    await getDb().execute(
      sql`update catalog.listings set price_kopecks = 900000 where id = ${listing.id}`,
    )

    const again = await deal.getDeal(actor, made.id)
    expect(again.priceKopecks).toBe(500_000n)
  })

  it('адрес тоже снимком: точку переименуют, а сделка помнит, куда ехали', async () => {
    const { actor, site } = await makeClient()
    const { listing } = await makeListing()
    const made = await deal.createFromListing({ actor, listingId: listing.id, siteId: site.id })

    await platform.updateSite({
      actor,
      siteId: site.id,
      name: site.name,
      address: 'Совсем другой адрес 99',
      zoneCode: 'msk-zao',
    })

    expect((await deal.getDeal(actor, made.id)).address).toBe('Москва, Тверская 12')
  })

  it('деньги считает в копейках целыми, без float (§6)', async () => {
    const { actor, site } = await makeClient()
    const { listing } = await makeListing(33_333n)

    const made = await deal.createFromListing({
      actor,
      listingId: listing.id,
      siteId: site.id,
      qty: '3',
    })

    expect(made.priceKopecks).toBe(99_999n)
    expect(typeof made.priceKopecks).toBe('bigint')
  })

  it('не даёт заказать снятую с витрины услугу', async () => {
    const { actor, site } = await makeClient()
    const { listing } = await makeListing()
    await getDb().execute(
      sql`update catalog.listings set status = 'archived' where id = ${listing.id}`,
    )

    const error = await rejection(
      deal.createFromListing({ actor, listingId: listing.id, siteId: site.id }),
    )
    expect(error.code).toBe('bad_deal')
  })

  it('не даёт заказать на чужую точку', async () => {
    const first = await makeClient()
    const other = await makeClient({
      companyName: 'Салон «Второй»',
      inn: '7743013901',
      email: 'olga@example.ru',
      phone: '+7 916 000-00-03',
      fullName: 'Ольга Титова',
    })
    const { listing } = await makeListing()

    await expect(
      deal.createFromListing({ actor: other.actor, listingId: listing.id, siteId: first.site.id }),
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('кладёт в очередь событие о новой сделке', async () => {
    const { actor, site } = await makeClient()
    const { listing } = await makeListing()
    await deal.createFromListing({ actor, listingId: listing.id, siteId: site.id })

    const rows = await getDb().execute<{ payload: Record<string, unknown> }>(
      sql`select payload from platform.outbox where type = 'deal.created'`,
    )
    expect(rows.length).toBe(1)
    // Копейки строкой: число потеряло бы точность на больших суммах
    expect(rows[0]?.payload).toMatchObject({ priceKopecks: '500000' })
  })
})

describe('переходы статусов на живой сделке (§8)', () => {
  async function newDeal() {
    const { actor, site } = await makeClient()
    const { listing } = await makeListing()
    const made = await deal.createFromListing({ actor, listingId: listing.id, siteId: site.id })
    return { actor, made }
  }

  it('ведёт сделку по всему пути до приёмки', async () => {
    const { actor, made } = await newDeal()

    for (const to of ['accepted', 'paid', 'in_progress', 'act_issued', 'act_signed', 'completed'] as const) {
      const moved = await deal.moveTo({ actor, dealId: made.id, to })
      expect(moved.status).toBe(to)
    }
  })

  /**
   * Главное правило площадки в действии: пока акт не подписан, «завершить»
   * сделку нельзя — а значит и заплатить подрядчику не из чего.
   */
  it('не даёт завершить сделку, пока акт не подписан', async () => {
    const { actor, made } = await newDeal()
    await deal.moveTo({ actor, dealId: made.id, to: 'accepted' })
    await deal.moveTo({ actor, dealId: made.id, to: 'paid' })
    await deal.moveTo({ actor, dealId: made.id, to: 'in_progress' })

    const error = await rejection(deal.moveTo({ actor, dealId: made.id, to: 'completed' }))
    expect(error.code).toBe('bad_transition')
    expect(await deal.canPayOut(made.id)).toBe(false)
  })

  it('разрешает выплату только после приёмки', async () => {
    const { actor, made } = await newDeal()
    for (const to of ['accepted', 'paid', 'in_progress', 'act_issued', 'act_signed'] as const) {
      await deal.moveTo({ actor, dealId: made.id, to })
      expect(await deal.canPayOut(made.id), `из «${to}» платить нельзя`).toBe(false)
    }
    await deal.moveTo({ actor, dealId: made.id, to: 'completed' })
    expect(await deal.canPayOut(made.id)).toBe(true)
  })

  it('спор закрывает оператор, а не сторона спора', async () => {
    const { actor, made } = await newDeal()
    await deal.moveTo({ actor, dealId: made.id, to: 'accepted' })
    await deal.moveTo({ actor, dealId: made.id, to: 'paid' })
    await deal.moveTo({ actor, dealId: made.id, to: 'disputed', reason: 'Не приехали в срок' })

    expect(await deal.canPayOut(made.id)).toBe(false)

    const error = await rejection(deal.moveTo({ actor, dealId: made.id, to: 'completed' }))
    expect(error.code).toBe('needs_operator')

    await deal.moveTo({ actor: operator, dealId: made.id, to: 'completed' })
    expect(await deal.canPayOut(made.id)).toBe(true)
  })

  it('требует причину у отмены и рекламации', async () => {
    const { actor, made } = await newDeal()
    expect((await rejection(deal.moveTo({ actor, dealId: made.id, to: 'cancelled' }))).code).toBe(
      'reason_required',
    )

    const cancelled = await deal.moveTo({
      actor,
      dealId: made.id,
      to: 'cancelled',
      reason: 'Передумали, нашли своими силами',
    })
    expect(cancelled.status).toBe('cancelled')
  })

  it('закрытую сделку не переоткрывает', async () => {
    const { actor, made } = await newDeal()
    await deal.moveTo({ actor, dealId: made.id, to: 'cancelled', reason: 'Передумали' })

    const error = await rejection(deal.moveTo({ actor, dealId: made.id, to: 'accepted' }))
    expect(error.code).toBe('bad_transition')
  })

  it('пишет историю каждого перехода с причиной', async () => {
    const { actor, made } = await newDeal()
    await deal.moveTo({ actor, dealId: made.id, to: 'cancelled', reason: 'Передумали' })

    const history = await deal.dealHistory(actor, made.id)
    expect(history.map((e) => e.toStatus)).toEqual(['new', 'cancelled'])
    expect(history[1]?.reason).toBe('Передумали')
    expect(history[1]?.actorName).toBe('Анна Ковалёва')
  })

  it('публикует событие о приёмке — по нему модуль выплат начнёт выплату', async () => {
    const { actor, made } = await newDeal()
    for (const to of ['accepted', 'paid', 'in_progress', 'act_issued', 'act_signed', 'completed'] as const) {
      await deal.moveTo({ actor, dealId: made.id, to })
    }

    const rows = await getDb().execute<{ type: string }>(
      sql`select type from platform.outbox where aggregate = 'deal' order by id`,
    )
    expect(rows.map((r) => r.type)).toContain('deal.completed')
  })
})

describe('кто какие сделки видит (§8)', () => {
  it('клиент не видит чужую сделку даже с идентификатором', async () => {
    const first = await makeClient()
    const other = await makeClient({
      companyName: 'Салон «Второй»',
      inn: '7743013901',
      email: 'olga@example.ru',
      phone: '+7 916 000-00-03',
      fullName: 'Ольга Титова',
    })
    const { listing } = await makeListing()
    const made = await deal.createFromListing({
      actor: first.actor,
      listingId: listing.id,
      siteId: first.site.id,
    })

    expect((await rejection(deal.getDeal(other.actor, made.id))).code).toBe('forbidden')
    expect((await deal.listDeals(other.actor)).total).toBe(0)
  })

  it('и не может перевести чужую сделку', async () => {
    const first = await makeClient()
    const other = await makeClient({
      companyName: 'Салон «Второй»',
      inn: '7743013901',
      email: 'olga@example.ru',
      phone: '+7 916 000-00-03',
      fullName: 'Ольга Титова',
    })
    const { listing } = await makeListing()
    const made = await deal.createFromListing({
      actor: first.actor,
      listingId: listing.id,
      siteId: first.site.id,
    })

    expect(
      (await rejection(deal.moveTo({ actor: other.actor, dealId: made.id, to: 'accepted' }))).code,
    ).toBe('forbidden')
  })

  it('на несуществующую сделку отвечает «не найдено», а не «не ваше»', async () => {
    const { actor } = await makeClient()
    const missing = '01a00000-0000-7000-8000-000000000000'
    expect((await rejection(deal.getDeal(actor, missing))).code).toBe('deal_not_found')
  })

  it('оператор видит все сделки', async () => {
    const { actor, site } = await makeClient()
    const { listing } = await makeListing()
    await deal.createFromListing({ actor, listingId: listing.id, siteId: site.id })

    expect((await deal.listDeals(operator)).total).toBe(1)
  })
})

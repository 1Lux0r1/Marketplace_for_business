import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { closeDb, getDb } from '@/shared/db'
import { resetConfigCache } from '@/shared/config'
import * as platform from '@/modules/platform'
import * as catalog from '@/modules/catalog'
import * as deal from '@/modules/deal'
import * as documents from '@/modules/documents'
import { dispatch, resetRegistry } from './registry'
import { registerSubscriptions } from './subscriptions'

/**
 * Документы выпускаются по событиям сделки, а не внутри неё (§4.5).
 * Здесь проверяется, что связь работает и что повторное событие
 * не выпускает второй счёт — событие может прийти дважды (§5).
 */

const DETAILS = {
  PLATFORM_LEGAL_NAME: 'ООО «Тестовая площадка»',
  PLATFORM_INN: '7700000000',
  PLATFORM_ADDRESS: 'Москва, Тестовая 1',
  PLATFORM_BANK_NAME: 'Тестовый банк',
  PLATFORM_BANK_BIC: '044525000',
  PLATFORM_BANK_ACCOUNT: '40702810000000000001',
  PLATFORM_BANK_CORR_ACCOUNT: '30101810000000000000',
}

beforeEach(async () => {
  Object.assign(process.env, DETAILS)
  resetConfigCache()
  resetRegistry()
  registerSubscriptions()

  const db = getDb()
  await db.execute(sql`truncate documents.documents, documents.counters`)
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

async function madeDeal() {
  const { userId, orgId, emailCode } = await platform.register({
    legalForm: 'company',
    companyName: 'Кофейня «Пример»',
    inn: '7701234560',
    fullName: 'Анна Ковалёва',
    email: 'anna@example.ru',
    phone: '+7 916 123-45-67',
    password: 'корова лошадь батарейка',
  })
  await platform.verifyEmail({ email: 'anna@example.ru', code: emailCode })
  const actor = await platform.getUser(userId)
  const site = await platform.addSite({
    actor,
    orgId,
    name: 'Кофейня на Тверской',
    address: 'Москва, Тверская 12',
    zoneCode: 'msk-cao',
  })

  const { orgId: contractorOrg } = await platform.register({
    legalForm: 'company',
    companyName: 'СанПро',
    inn: '7707083893',
    fullName: 'Борис Орлов',
    email: 'boris@example.ru',
    phone: '+7 916 000-00-02',
    password: 'корова лошадь батарейка',
  })
  const contractor = await catalog.createContractor({ orgId: contractorOrg, status: 'active' })
  const [category] = await getDb().execute<{ id: string }>(sql`
    insert into catalog.categories (id, code, name, kind)
    values (gen_random_uuid(), 'sanitation', 'Санобработка', 'service') returning id`)
  const listing = await catalog.createListing({
    contractorId: contractor.id,
    categoryId: category!.id,
    title: 'Санобработка кухни',
    unit: 'объект',
    priceKopecks: 500_000n,
    minQty: '1',
    status: 'published',
  })

  const made = await deal.createFromListing({ actor, listingId: listing.id, siteId: site.id })
  return { actor, made }
}

/**
 * `dispatch` не бросает, а возвращает причину: воркер должен пережить
 * сбой обработчика. В тесте молчаливый провал бесполезен — разворачиваем.
 */
async function deliver(type: string, dealId: string): Promise<void> {
  const result = await dispatch(event(type, dealId))
  if (!result.ok) throw new Error(`обработчик «${type}» упал: ${result.error}`)
}

const event = (type: string, dealId: string) => ({
  id: 1,
  type,
  aggregate: 'deal',
  aggregateId: dealId,
  payload: { dealId },
  occurredAt: new Date(),
  attempts: 0,
})

describe('документы выпускаются по событиям сделки', () => {
  it('принятая сделка получает договор и счёт', async () => {
    const { actor, made } = await madeDeal()
    await deal.moveTo({ actor, dealId: made.id, to: 'accepted' })

    await deliver('deal.accepted', made.id)

    const issued = await documents.listForDeal(made.id)
    expect(issued.map((d) => d.kind).sort()).toEqual(['contract', 'invoice'])
    expect(issued.find((d) => d.kind === 'invoice')?.amountKopecks).toBe(500_000n)
  })

  /** Событие может прийти дважды (§5). Два счёта на одну сделку — вопрос от бухгалтера. */
  it('повторное событие не выпускает второй счёт', async () => {
    const { actor, made } = await madeDeal()
    await deal.moveTo({ actor, dealId: made.id, to: 'accepted' })

    await deliver('deal.accepted', made.id)
    await deliver('deal.accepted', made.id)

    const invoices = (await documents.listForDeal(made.id)).filter((d) => d.kind === 'invoice')
    expect(invoices.length).toBe(1)
  })

  it('готовая работа получает акт, и он ещё не подписан', async () => {
    const { actor, made } = await madeDeal()
    for (const to of ['accepted', 'paid', 'in_progress', 'act_issued'] as const) {
      await deal.moveTo({ actor, dealId: made.id, to })
    }

    await deliver('deal.act_issued', made.id)

    const acts = (await documents.listForDeal(made.id)).filter((d) => d.kind === 'act')
    expect(acts.length).toBe(1)
    expect(acts[0]?.status).toBe('issued')
    expect(await documents.hasSignedAct(made.id)).toBe(false)
  })

  it('повторное событие не выпускает второй акт', async () => {
    const { actor, made } = await madeDeal()
    for (const to of ['accepted', 'paid', 'in_progress', 'act_issued'] as const) {
      await deal.moveTo({ actor, dealId: made.id, to })
    }

    await deliver('deal.act_issued', made.id)
    await deliver('deal.act_issued', made.id)

    expect((await documents.listForDeal(made.id)).filter((d) => d.kind === 'act').length).toBe(1)
  })

  /**
   * Документ должен помнить, кто и за сколько: через полгода по нему
   * будут разбирать спор, а не по записи в базе.
   */
  it('в счёте видно заказчика, подрядчика и сумму', async () => {
    const { actor, made } = await madeDeal()
    await deal.moveTo({ actor, dealId: made.id, to: 'accepted' })
    await deliver('deal.accepted', made.id)

    const invoice = (await documents.listForDeal(made.id)).find((d) => d.kind === 'invoice')
    expect(invoice?.html).toContain('Кофейня «Пример»')
    expect(invoice?.html).toContain('СанПро')
    // Сумма форматируется с неразрывными пробелами — сравниваем по цифрам,
    // а не по строке: иначе тест ловит типографику, а не деньги
    expect(invoice?.html.replace(/\s/gu, '')).toContain('5000₽')
  })
})

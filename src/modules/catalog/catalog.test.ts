import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { closeDb, getDb } from '@/shared/db'
import * as platform from '@/modules/platform'
import * as catalog from './index'
import { CatalogError } from './errors'

/**
 * Каталог. Проверяется отбор кандидатов — на нём держится подбор — и главная
 * межмодульная граница: `catalog` не должен ходить в таблицы `platform`.
 */

beforeEach(async () => {
  const db = getDb()
  await db.execute(sql`truncate catalog.contractors, catalog.categories cascade`)
  await db.execute(sql`truncate platform.orgs cascade`)
})

afterAll(async () => {
  await closeDb()
})

async function makeOrg(name: string, inn: string) {
  return platform.createOrg({ legalForm: 'company', name, inn })
}

async function makeCategory(code: string, name: string) {
  const db = getDb()
  const [row] = await db.execute<{ id: string }>(sql`
    insert into catalog.categories (id, code, name, kind)
    values (gen_random_uuid(), ${code}, ${name}, 'service') returning id`)
  return row!.id
}

async function makeContractor(options: {
  name: string
  inn: string
  categoryIds: string[]
  zones: string[]
  status?: 'draft' | 'active' | 'paused' | 'blocked'
  rating?: number
}) {
  const org = await makeOrg(options.name, options.inn)
  const contractor = await catalog.createContractor({
    orgId: org.id,
    status: options.status ?? 'active',
    manualRating: options.rating ?? 3,
  })
  await catalog.setContractorCategories(contractor.id, options.categoryIds)
  await catalog.setContractorZones(contractor.id, options.zones)
  return contractor
}

describe('граница модулей', () => {
  it('подрядчика нельзя завести на несуществующую компанию', async () => {
    // Внешнего ключа между схемами нет (§4.3) — целостность держит код,
    // и ошибка должна быть человеческой, а не «нарушение ограничения»
    await expect(
      catalog.createContractor({ orgId: '01a07261-0000-7000-8000-00000000dead' }),
    ).rejects.toMatchObject({ code: 'org_not_found' })
  })

  it('одна компания — один подрядчик', async () => {
    const org = await makeOrg('Кофейня «Пример»', '7701234567')
    await catalog.createContractor({ orgId: org.id })
    await expect(catalog.createContractor({ orgId: org.id })).rejects.toMatchObject({
      code: 'org_already_contractor',
    })
  })

  it('в коде каталога нет ни одного запроса к таблицам platform', () => {
    // Правило §4.2, проверяемое, а не на словах: один такой запрос — и модули
    // перестают выделяться в сервисы без переписывания
    const dir = 'src/modules/catalog'
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    const hits: string[] = []

    for (const file of files) {
      const code = readFileSync(join(dir, file), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gmu, '')
      for (const match of code.matchAll(/platform\.[a-z_]+\b/giu)) {
        // platform.getOrg() — это вызов соседа через его интерфейс, так можно.
        // platform.orgs — это запрос к его таблице, так нельзя
        if (/^platform\.[a-z_]+$/u.test(match[0]) && !/^platform\.(get|list|find)/u.test(match[0])) {
          hits.push(`${file}: ${match[0]}`)
        }
      }
    }

    expect(hits, hits.join(', ')).toEqual([])
  })
})

describe('зоны', () => {
  it('коды зон приходят из одного места', () => {
    const zones = catalog.listZones()
    expect(zones.length).toBeGreaterThan(10)
    expect(zones.some((z) => z.code === 'msk' && z.kind === 'city')).toBe(true)
    expect(zones.every((z) => z.code === z.code.toLowerCase())).toBe(true)
  })

  it('зону не из справочника подрядчику не поставить', async () => {
    const org = await makeOrg('Кофейня', '7701234567')
    const contractor = await catalog.createContractor({ orgId: org.id })

    // Иначе в базе окажутся «msk-cao», «МСК-ЦАО» и «центр»,
    // и подбор перестанет находить половину подрядчиков
    await expect(catalog.setContractorZones(contractor.id, ['центр'])).rejects.toBeInstanceOf(
      CatalogError,
    )
  })
})

describe('отбор кандидатов', () => {
  it('находит по категории и зоне', async () => {
    const cleaning = await makeCategory('cleaning', 'Клининг')
    const hvac = await makeCategory('hvac', 'Вентиляция')

    const ours = await makeContractor({
      name: 'Демо-Чистый', inn: '7701000001', categoryIds: [cleaning], zones: ['msk-cao'],
    })
    await makeContractor({
      name: 'Демо-Инженерка', inn: '7701000002', categoryIds: [hvac], zones: ['msk-cao'],
    })

    const found = await catalog.findCandidates({ categoryId: cleaning, zoneCode: 'msk-cao' })
    expect(found.map((c) => c.id)).toEqual([ours.id])
  })

  it('«Москва целиком» покрывает любой округ', async () => {
    const cleaning = await makeCategory('cleaning', 'Клининг')
    const everywhere = await makeContractor({
      name: 'Демо-Везде', inn: '7701000001', categoryIds: [cleaning], zones: ['msk'],
    })

    // Иначе подрядчик, работающий по всему городу, не найдётся ни в одном округе
    const found = await catalog.findCandidates({ categoryId: cleaning, zoneCode: 'msk-tao' })
    expect(found.map((c) => c.id)).toEqual([everywhere.id])
  })

  it('в чужой зоне не находит', async () => {
    const cleaning = await makeCategory('cleaning', 'Клининг')
    await makeContractor({
      name: 'Демо-Центр', inn: '7701000001', categoryIds: [cleaning], zones: ['msk-cao'],
    })
    expect(await catalog.findCandidates({ categoryId: cleaning, zoneCode: 'msk-tao' })).toEqual([])
  })

  it('берёт только активных', async () => {
    const cleaning = await makeCategory('cleaning', 'Клининг')
    await makeContractor({
      name: 'Демо-Пауза', inn: '7701000001', categoryIds: [cleaning],
      zones: ['msk'], status: 'paused',
    })
    await makeContractor({
      name: 'Демо-Блок', inn: '7701000002', categoryIds: [cleaning],
      zones: ['msk'], status: 'blocked',
    })

    // Заблокированный подрядчик не должен получать предложения
    expect(await catalog.findCandidates({ categoryId: cleaning, zoneCode: 'msk' })).toEqual([])
  })

  it('сильных предлагает первыми', async () => {
    const cleaning = await makeCategory('cleaning', 'Клининг')
    await makeContractor({
      name: 'Демо-Троечник', inn: '7701000001', categoryIds: [cleaning], zones: ['msk'], rating: 3,
    })
    const best = await makeContractor({
      name: 'Демо-Отличник', inn: '7701000002', categoryIds: [cleaning], zones: ['msk'], rating: 5,
    })

    const found = await catalog.findCandidates({ categoryId: cleaning, zoneCode: 'msk' })
    expect(found[0]?.id).toBe(best.id)
  })

  it('не отдаёт больше, чем просили', async () => {
    const cleaning = await makeCategory('cleaning', 'Клининг')
    for (let i = 0; i < 4; i += 1) {
      await makeContractor({
        name: `Демо-${i}`, inn: `770100000${i}`, categoryIds: [cleaning], zones: ['msk'],
      })
    }
    expect(await catalog.findCandidates({ categoryId: cleaning, zoneCode: 'msk', limit: 2 }))
      .toHaveLength(2)
  })

  it('несуществующую зону отклоняет, а не отдаёт пустой список', async () => {
    const cleaning = await makeCategory('cleaning', 'Клининг')
    // Пустой список выглядел бы как «подрядчиков нет», а на деле опечатка
    await expect(
      catalog.findCandidates({ categoryId: cleaning, zoneCode: 'опечатка' }),
    ).rejects.toMatchObject({ code: 'unknown_zone' })
  })
})

describe('карточки каталога', () => {
  it('цена хранится в копейках целым числом', async () => {
    const cleaning = await makeCategory('cleaning', 'Клининг')
    const contractor = await makeContractor({
      name: 'Демо-Чистый', inn: '7701000001', categoryIds: [cleaning], zones: ['msk'],
    })

    const listing = await catalog.createListing({
      contractorId: contractor.id,
      categoryId: cleaning,
      title: 'Уборка после ремонта',
      unit: 'м2',
      priceKopecks: 18_000n,
      status: 'published',
    })

    expect(listing.priceKopecks).toBe(18_000n)
    expect(typeof listing.priceKopecks).toBe('bigint')
  })

  it('бесплатных и отрицательных карточек не бывает', async () => {
    const cleaning = await makeCategory('cleaning', 'Клининг')
    const contractor = await makeContractor({
      name: 'Демо-Чистый', inn: '7701000001', categoryIds: [cleaning], zones: ['msk'],
    })

    await expect(
      catalog.createListing({
        contractorId: contractor.id, categoryId: cleaning,
        title: 'Даром', unit: 'шт', priceKopecks: 0n,
      }),
    ).rejects.toMatchObject({ code: 'bad_price' })
  })

  it('опубликованная карточка помнит, когда её опубликовали', async () => {
    const cleaning = await makeCategory('cleaning', 'Клининг')
    const contractor = await makeContractor({
      name: 'Демо-Чистый', inn: '7701000001', categoryIds: [cleaning], zones: ['msk'],
    })

    const draft = await catalog.createListing({
      contractorId: contractor.id, categoryId: cleaning,
      title: 'Черновик', unit: 'шт', priceKopecks: 100_00n,
    })
    const published = await catalog.createListing({
      contractorId: contractor.id, categoryId: cleaning,
      title: 'На витрине', unit: 'шт', priceKopecks: 100_00n, status: 'published',
    })

    expect(draft.publishedAt).toBeNull()
    expect(published.publishedAt).toBeInstanceOf(Date)
  })
})

describe('витрина', () => {
  async function makeStorefront() {
    const cleaning = await makeCategory('cleaning', 'Клининг')
    const hvac = await makeCategory('hvac', 'Вентиляция')
    const contractor = await makeContractor({
      name: 'Демо-Чистый', inn: '7701000001',
      categoryIds: [cleaning, hvac], zones: ['msk-cao'], rating: 5,
    })
    return { cleaning, hvac, contractor }
  }

  async function makeListing(options: {
    contractorId: string
    categoryId: string
    title: string
    rubles: number
    status?: 'draft' | 'published'
    description?: string
  }) {
    return catalog.createListing({
      contractorId: options.contractorId,
      categoryId: options.categoryId,
      title: options.title,
      description: options.description,
      unit: 'объект',
      priceKopecks: BigInt(options.rubles) * 100n,
      status: options.status ?? 'published',
    })
  }

  it('показывает только опубликованные карточки', async () => {
    const { cleaning, contractor } = await makeStorefront()
    await makeListing({ contractorId: contractor.id, categoryId: cleaning, title: 'На витрине', rubles: 5000 })
    await makeListing({
      contractorId: contractor.id, categoryId: cleaning,
      title: 'Черновик', rubles: 4000, status: 'draft',
    })

    // Черновики и то, что ждёт модерации, — внутренняя кухня, клиенту её не показывают
    const found = await catalog.searchListings({})
    expect(found.items.map((i) => i.title)).toEqual(['На витрине'])
    expect(found.total).toBe(1)
  })

  it('прячет карточки неактивного подрядчика', async () => {
    const { cleaning, contractor } = await makeStorefront()
    await makeListing({ contractorId: contractor.id, categoryId: cleaning, title: 'Уборка', rubles: 5000 })
    await catalog.setContractorStatus(contractor.id, 'blocked')

    // Иначе заблокированный подрядчик продолжал бы получать заказы
    expect((await catalog.searchListings({})).items).toEqual([])
  })

  it('фильтрует по категории', async () => {
    const { cleaning, hvac, contractor } = await makeStorefront()
    await makeListing({ contractorId: contractor.id, categoryId: cleaning, title: 'Уборка', rubles: 5000 })
    await makeListing({ contractorId: contractor.id, categoryId: hvac, title: 'Вытяжка', rubles: 12000 })

    const found = await catalog.searchListings({ categoryId: hvac })
    expect(found.items.map((i) => i.title)).toEqual(['Вытяжка'])
  })

  it('фильтрует по зоне подрядчика', async () => {
    const { cleaning, contractor } = await makeStorefront()
    await makeListing({ contractorId: contractor.id, categoryId: cleaning, title: 'Уборка', rubles: 5000 })

    expect((await catalog.searchListings({ zoneCode: 'msk-cao' })).items).toHaveLength(1)
    expect((await catalog.searchListings({ zoneCode: 'msk-tao' })).items).toEqual([])
  })

  it('ищет по названию и описанию', async () => {
    const { cleaning, contractor } = await makeStorefront()
    await makeListing({
      contractorId: contractor.id, categoryId: cleaning,
      title: 'Генеральная уборка', rubles: 5000, description: 'Мойка окон и вынос мусора',
    })
    await makeListing({ contractorId: contractor.id, categoryId: cleaning, title: 'Вытяжка', rubles: 12000 })

    expect((await catalog.searchListings({ query: 'генеральная' })).items).toHaveLength(1)
    // По описанию тоже: человек ищет «окна», а в названии их нет
    expect((await catalog.searchListings({ query: 'окон' })).items).toHaveLength(1)
    expect((await catalog.searchListings({ query: 'бухгалтерия' })).items).toEqual([])
  })

  it('символы подстановки в запросе ничего не ломают', async () => {
    const { cleaning, contractor } = await makeStorefront()
    await makeListing({ contractorId: contractor.id, categoryId: cleaning, title: 'Уборка', rubles: 5000 })

    // Процент в поиске должен искать процент, а не «что угодно»
    expect((await catalog.searchListings({ query: '%' })).items).toEqual([])
  })

  it('отдаёт постранично и сообщает, сколько всего', async () => {
    const { cleaning, contractor } = await makeStorefront()
    for (let i = 0; i < 5; i += 1) {
      await makeListing({
        contractorId: contractor.id, categoryId: cleaning,
        title: `Услуга ${i}`, rubles: 1000 + i,
      })
    }

    const page = await catalog.searchListings({ limit: 2, offset: 2 })
    expect(page.items).toHaveLength(2)
    // Всего — по всей выборке, а не по странице: иначе не нарисовать «ещё 3»
    expect(page.total).toBe(5)
  })

  it('карточка услуги отдаётся по номеру, но только опубликованная', async () => {
    const { cleaning, contractor } = await makeStorefront()
    const published = await makeListing({
      contractorId: contractor.id, categoryId: cleaning, title: 'Уборка', rubles: 5000,
    })
    const draft = await makeListing({
      contractorId: contractor.id, categoryId: cleaning,
      title: 'Черновик', rubles: 4000, status: 'draft',
    })

    const card = await catalog.getStorefrontListing(published.id)
    expect(card.title).toBe('Уборка')
    expect(card.categoryName).toBe('Клининг')
    expect(card.zones).toEqual(['msk-cao'])

    // Черновик по прямой ссылке тоже показывать нельзя
    await expect(catalog.getStorefrontListing(draft.id)).rejects.toMatchObject({
      code: 'listing_not_found',
    })
  })

  it('несуществующую зону отклоняет, а не показывает пустую витрину', async () => {
    await expect(catalog.searchListings({ zoneCode: 'опечатка' })).rejects.toMatchObject({
      code: 'unknown_zone',
    })
  })
})

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
  await db.execute(sql`truncate platform.orgs, platform.outbox restart identity cascade`)
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
    // перестают выделяться в сервисы без переписывания.
    //
    // Ищем именно запрос — «from platform.orgs», «join platform.users».
    // Вызов соседа через его интерфейс (`platform.getOrg()`, `platform.publish()`)
    // не только разрешён, но и есть единственный правильный способ (§4.4).
    const dir = 'src/modules/catalog'
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    const hits: string[] = []

    for (const file of files) {
      const code = readFileSync(join(dir, file), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gmu, '')
      for (const match of code.matchAll(/\b(from|join|into|update|delete\s+from)\s+platform\.\w+/giu)) {
        hits.push(`${file}: ${match[0]}`)
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

describe('саморегистрация подрядчика', () => {
  const form = {
    inn: '7701234560',
    legalForm: 'company' as const,
    companyName: 'Демо-СанПро',
    fullName: 'Игорь Соколов',
    position: 'Директор',
    email: 'igor@example.ru',
    phone: '+79160000001',
    password: 'корова лошадь батарейка',
  }

  it('подрядчик заводит себя сам и ждёт проверки в черновике', async () => {
    const { contractorId, orgId } = await catalog.registerContractor(form)

    const card = await catalog.getContractor(contractorId)
    // Заявок не получает, пока ИНН не проверен
    expect(card.status).toBe('draft')

    const org = await platform.getOrg(orgId)
    expect(org.isContractor).toBe(true)
    expect(org.innVerifiedAt).toBeNull()
  })

  it('регистрация публикует событие — проверка пойдёт следом', async () => {
    const { contractorId } = await catalog.registerContractor(form)

    const [event] = (await platform.claimOutboxBatch(10)).filter(
      (e) => e.type === 'contractor.registered',
    )
    expect(event?.aggregateId).toBe(contractorId)
    expect(event?.payload.inn).toBe('7701234560')

    // ФИО в событие не кладём: персональные данные живут в одном месте
    expect(JSON.stringify(event?.payload)).not.toContain('Соколов')
  })

  it('опечатку в ИНН ловит до всякого справочника', async () => {
    // «Проверьте номер» и «компания не найдена» — разные вещи и разные
    // следующие шаги; справочник платный, дёргать его на опечатку незачем
    await expect(catalog.registerContractor({ ...form, inn: '7701234561' })).rejects.toMatchObject({
      code: 'bad_inn',
    })
  })

  it('повторная регистрация с тем же ИНН не создаёт вторую компанию', async () => {
    await catalog.registerContractor(form)

    await expect(
      catalog.registerContractor({ ...form, email: 'other@example.ru', phone: '+79160000002' }),
    ).rejects.toBeInstanceOf(CatalogError)

    // Компания осталась одна — иначе на одно юрлицо было бы две записи
    const db = getDb()
    const [row] = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from platform.orgs where inn = '7701234560'`,
    )
    expect(row?.n).toBe(1)
  })

  it('уже зарегистрированная компания может стать подрядчиком', async () => {
    // Одна и та же компания вправе и заказывать, и выполнять (§1)
    const registered = await platform.register({
      legalForm: 'company',
      companyName: 'Кофейня «Пример»',
      inn: '7701234560',
      fullName: 'Анна Ковалёва',
      email: 'anna@example.ru',
      phone: '+79161234567',
      password: 'корова лошадь батарейка',
    })

    const { orgId, contractorId } = await catalog.registerContractor({
      ...form,
      fullName: 'Анна Ковалёва',
      email: 'anna@example.ru',
    })

    expect(orgId).toBe(registered.orgId)
    expect((await catalog.getContractor(contractorId)).status).toBe('draft')
  })
})

describe('проверка ИНН', () => {
  async function registerOne() {
    return catalog.registerContractor({
      inn: '7701234560',
      legalForm: 'company',
      companyName: 'Демо-СанПро',
      fullName: 'Игорь Соколов',
      email: 'igor@example.ru',
      phone: '+79160000001',
      password: 'корова лошадь батарейка',
    })
  }

  it('недоступный справочник не ломает регистрацию, а отправляет её оператору', async () => {
    const { contractorId, orgId } = await registerOne()

    // Справочник не подключён — именно это состояние сейчас и есть
    await catalog.applyInnVerdict({
      contractorId,
      verified: false,
      details: { status: 'unavailable', reason: 'справочник не подключён' },
    })

    // Подрядчик жив и ждёт человека, а не получил отказ
    expect((await catalog.getContractor(contractorId)).status).toBe('draft')
    expect((await catalog.pendingVerification()).map((c) => c.id)).toContain(contractorId)

    // И мы помним, почему не проверили: через полгода надо уметь ответить
    const org = await platform.getOrg(orgId)
    expect(org.innVerifiedAt).toBeNull()
  })

  it('подтверждённый ИНН включает подрядчика', async () => {
    const { contractorId, orgId } = await registerOne()

    await catalog.applyInnVerdict({
      contractorId,
      verified: true,
      details: { status: 'found', name: 'ООО «Демо-СанПро»', active: true },
    })

    expect((await catalog.getContractor(contractorId)).status).toBe('active')
    expect((await platform.getOrg(orgId)).innVerifiedAt).toBeInstanceOf(Date)
  })

  it('повторный итог ничего не ломает', async () => {
    const { contractorId } = await registerOne()
    const verdict = {
      contractorId,
      verified: true,
      details: { status: 'found' as const, active: true },
    }

    // Событие может прийти дважды (§5) — второй раз не должен ничего менять
    await catalog.applyInnVerdict(verdict)
    await catalog.applyInnVerdict(verdict)

    expect((await catalog.getContractor(contractorId)).status).toBe('active')
  })

  it('решение оператора сильнее машинного', async () => {
    const { contractorId } = await registerOne()
    await catalog.setContractorStatus(contractorId, 'blocked')

    await catalog.applyInnVerdict({
      contractorId,
      verified: true,
      details: { status: 'found', active: true },
    })

    // Заблокированного оператором справочник разблокировать не может
    expect((await catalog.getContractor(contractorId)).status).toBe('blocked')
  })
})

describe('события об итоге проверки', () => {
  async function registerAndClear() {
    const r = await catalog.registerContractor({
      inn: '7701234560',
      legalForm: 'company',
      companyName: 'Демо-СанПро',
      fullName: 'Игорь Соколов',
      email: 'igor@example.ru',
      phone: '+79160000001',
      password: 'корова лошадь батарейка',
    })
    await platform.claimOutboxBatch(50)
    const db = getDb()
    await db.execute(sql`update platform.outbox set processed_at = now()`)
    return r
  }

  it('подтверждение публикует contractor.verified', async () => {
    const { contractorId } = await registerAndClear()
    await catalog.applyInnVerdict({ contractorId, verified: true, details: { status: 'found' } })

    const events = await platform.claimOutboxBatch(10)
    expect(events.map((e) => e.type)).toEqual(['contractor.verified'])
  })

  it('отказ публикует contractor.rejected', async () => {
    const { contractorId } = await registerAndClear()
    await catalog.applyInnVerdict({
      contractorId,
      verified: false,
      details: { status: 'unavailable' },
    })

    const events = await platform.claimOutboxBatch(10)
    expect(events.map((e) => e.type)).toEqual(['contractor.rejected'])
  })

  it('повторный итог второго события не создаёт', async () => {
    const { contractorId } = await registerAndClear()
    const verdict = { contractorId, verified: true, details: { status: 'found' as const } }

    await catalog.applyInnVerdict(verdict)
    await catalog.applyInnVerdict(verdict)

    // Иначе подрядчик получил бы два письма об одном и том же
    const events = await platform.claimOutboxBatch(10)
    expect(events).toHaveLength(1)
  })
})

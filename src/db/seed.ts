import { sql } from 'drizzle-orm'
import { config } from '@/shared/config'
import { closeDb, getDb } from '@/shared/db'
import { uuidv7 } from '@/shared/id'
import * as platform from '@/modules/platform'
import * as catalog from '@/modules/catalog'

/**
 * Демо-данные для разработки и демо-режима.
 *
 * ВНИМАНИЕ, ЧТО ЗДЕСЬ ПРАВДА, А ЧТО ВЫДУМАНО:
 *
 * - **Категории — настоящие.** Двенадцать направлений первой волны
 *   из `docs/05-sprint-01.md`.
 * - **Зоны — настоящие.** Административные округа Москвы.
 * - **Компании, люди, цены и сроки — ВЫДУМАНЫ.** Правдоподобны, но взяты
 *   из головы: рыночных ставок по этим услугам у нас нет (§9.7). Ни одна
 *   цифра отсюда не годится для расчётов, коммерческих предложений
 *   и разговоров с инвестором.
 *
 * Названия компаний нарочно начинаются со слова «Демо» — чтобы через полгода
 * никто не принял эти строки за настоящих подрядчиков.
 *
 * Запускать: `pnpm db:seed`. Повторный запуск безопасен — сначала чистит
 * то, что засеял, и засевает заново.
 */

type CategorySeed = { code: string; name: string; kind: 'service' | 'goods'; sortOrder: number }

const CATEGORIES: CategorySeed[] = [
  { code: 'sanitation', name: 'Санобработка', kind: 'service', sortOrder: 10 },
  { code: 'disinsection', name: 'Дезинсекция', kind: 'service', sortOrder: 20 },
  { code: 'deratization', name: 'Дератизация', kind: 'service', sortOrder: 30 },
  { code: 'cleaning', name: 'Клининг', kind: 'service', sortOrder: 40 },
  { code: 'hvac', name: 'Вентиляция и кондиционирование', kind: 'service', sortOrder: 50 },
  { code: 'electrical', name: 'Электрика', kind: 'service', sortOrder: 60 },
  { code: 'plumbing', name: 'Сантехника', kind: 'service', sortOrder: 70 },
  { code: 'labour-safety', name: 'Охрана труда', kind: 'service', sortOrder: 80 },
  { code: 'sout', name: 'СОУТ', kind: 'service', sortOrder: 90 },
  { code: 'fire-safety', name: 'Пожарная безопасность', kind: 'service', sortOrder: 100 },
  { code: 'prof-chemistry', name: 'Профхимия', kind: 'goods', sortOrder: 110 },
  { code: 'supplies', name: 'Расходники', kind: 'goods', sortOrder: 120 },
]

/** Подрядчики. Всё выдумано: и компании, и люди, и рейтинги. */
const CONTRACTORS = [
  {
    name: 'Демо-СанПро',
    inn: '7701000001',
    person: 'Игорь Соколов',
    email: 'demo-sanpro@example.ru',
    phone: '+79160000001',
    rating: 5,
    categories: ['sanitation', 'disinsection', 'deratization'],
    zones: ['msk-cao', 'msk-sao', 'msk-svao'],
  },
  {
    name: 'Демо-Чистый Свет',
    inn: '7701000002',
    person: 'Марина Гущина',
    email: 'demo-cleaning@example.ru',
    phone: '+79160000002',
    rating: 4,
    categories: ['cleaning'],
    zones: ['msk'],
  },
  {
    name: 'Демо-Инженерка',
    inn: '7701000003',
    person: 'Павел Тарасов',
    email: 'demo-eng@example.ru',
    phone: '+79160000003',
    rating: 4,
    categories: ['hvac', 'electrical', 'plumbing'],
    zones: ['msk-cao', 'msk-zao', 'msk-uzao'],
  },
  {
    name: 'Демо-Охрана труда',
    inn: '7701000004',
    person: 'Елена Бирюкова',
    email: 'demo-safety@example.ru',
    phone: '+79160000004',
    rating: 3,
    categories: ['labour-safety', 'sout', 'fire-safety'],
    zones: ['msk'],
  },
  {
    name: 'Демо-Снабжение',
    inn: '7701000005',
    person: 'Артём Логинов',
    email: 'demo-supply@example.ru',
    phone: '+79160000005',
    rating: 4,
    categories: ['prof-chemistry', 'supplies'],
    zones: ['msk'],
    status: 'paused' as const,
  },
]

/** Карточки каталога. Цены ВЫДУМАНЫ, см. предупреждение наверху файла. */
const LISTINGS: Record<string, Array<{
  category: string
  title: string
  unit: string
  rubles: number
  leadHours: number
  description: string
}>> = {
  'Демо-СанПро': [
    {
      category: 'sanitation',
      title: 'Санобработка помещения до 100 м²',
      unit: 'объект',
      rubles: 4500,
      leadHours: 24,
      description: 'Обработка зала и подсобных помещений. Договор, акт, отчётные документы.',
    },
    {
      category: 'disinsection',
      title: 'Дезинсекция от тараканов, кухня',
      unit: 'объект',
      rubles: 6200,
      leadHours: 12,
      description: 'Гелевая обработка без запаха, работа ночью. Повторный выезд через 14 дней.',
    },
  ],
  'Демо-Чистый Свет': [
    {
      category: 'cleaning',
      title: 'Генеральная уборка после ремонта',
      unit: 'м2',
      rubles: 180,
      leadHours: 48,
      description: 'Мойка окон, вынос строительного мусора, финишная уборка.',
    },
    {
      category: 'cleaning',
      title: 'Ежедневная уборка торгового зала',
      unit: 'час',
      rubles: 650,
      leadHours: 24,
      description: 'Клинер с расходниками. От четырёх часов в смену.',
    },
  ],
  'Демо-Инженерка': [
    {
      category: 'hvac',
      title: 'Чистка и обслуживание вытяжки на кухне',
      unit: 'объект',
      rubles: 12000,
      leadHours: 72,
      description: 'Разбор, промывка зонта и воздуховодов, замер тяги, протокол.',
    },
    {
      category: 'electrical',
      title: 'Замена электрощита на объекте',
      unit: 'объект',
      rubles: 28000,
      leadHours: 96,
      description: 'Щит, автоматы, УЗО, маркировка линий, исполнительная схема.',
    },
  ],
  'Демо-Охрана труда': [
    {
      category: 'sout',
      title: 'СОУТ рабочего места',
      unit: 'шт',
      rubles: 1800,
      leadHours: 168,
      description: 'Замеры, отчёт, подача сведений в реестр. От пяти рабочих мест.',
    },
    {
      category: 'labour-safety',
      title: 'Обучение по охране труда, один сотрудник',
      unit: 'шт',
      rubles: 2400,
      leadHours: 72,
      description: 'Дистанционно, с протоколом и удостоверением.',
    },
  ],
}

async function main(): Promise<void> {
  const cfg = config()
  if (cfg.NODE_ENV === 'production') {
    throw new Error('db:seed в проде запускать нельзя: это демо-данные, а не миграция')
  }

  const db = getDb()

  /**
   * Повторный запуск безопасен: убираем только то, что засеяли сами.
   *
   * Порядок важен и сам по себе является проверкой: на компанию ссылаются
   * люди и точки, и удалять её надо после них. `credentials` и `sessions`
   * уходят следом за человеком сами — у них связь с удалением.
   *
   * Демо-компания может обрасти людьми и точками не только от сида: её заводят
   * руками, проверяя экраны. Поэтому чистим по ссылке на компанию, а не по имени.
   */
  const demoOrgs = sql`select id from platform.orgs where name like 'Демо-%'`
  await db.execute(sql`delete from catalog.contractors where org_id in (${demoOrgs})`)
  await db.execute(sql`delete from platform.org_sites where org_id in (${demoOrgs})`)
  await db.execute(sql`delete from platform.users where org_id in (${demoOrgs})`)
  await db.execute(sql`delete from platform.orgs where name like 'Демо-%'`)

  console.log('Категории...')
  const categoryIds = new Map<string, string>()
  for (const category of CATEGORIES) {
    const id = await upsertCategory(category)
    categoryIds.set(category.code, id)
  }
  console.log(`  ${CATEGORIES.length} шт.`)

  console.log('\nПодрядчики...')
  for (const demo of CONTRACTORS) {
    const org = await platform.createOrg({
      legalForm: 'company',
      name: demo.name,
      inn: demo.inn,
    })
    await platform.enableContractorRole(org.id)

    const contractor = await catalog.createContractor({
      orgId: org.id,
      status: demo.status ?? 'active',
      manualRating: demo.rating,
      notes: 'Демонстрационные данные. Настоящих договорённостей за этой записью нет.',
    })
    await catalog.setContractorCategories(
      contractor.id,
      demo.categories.map((code) => categoryIds.get(code)!),
    )
    await catalog.setContractorZones(contractor.id, demo.zones)

    const listings = LISTINGS[demo.name] ?? []
    for (const listing of listings) {
      await catalog.createListing({
        contractorId: contractor.id,
        categoryId: categoryIds.get(listing.category)!,
        title: listing.title,
        description: listing.description,
        unit: listing.unit,
        // Рубли в копейки: в базе деньги только целыми копейками (§6)
        priceKopecks: BigInt(listing.rubles) * 100n,
        leadTimeHours: listing.leadHours,
        status: 'published',
      })
    }
    console.log(
      `  ${demo.name} · ${demo.categories.length} категорий · ` +
        `${demo.zones.length} зон · ${listings.length} карточек`,
    )
  }

  console.log(`
Готово.

ВСЕ ЦЕНЫ И КОМПАНИИ ЗДЕСЬ ВЫДУМАНЫ. Категории и округа Москвы — настоящие,
остальное взято из головы и годится только чтобы посмотреть, как выглядит
система с данными. Для расчётов и разговоров с инвестором эти цифры не годятся.`)
}

/** Категории живут долго и на них ссылаются — заводим по коду, не плодя дубли. */
async function upsertCategory(category: CategorySeed): Promise<string> {
  const db = getDb()
  const [row] = await db.execute<{ id: string }>(sql`
    insert into catalog.categories (id, code, name, kind, sort_order)
    values (${uuidv7()}, ${category.code}, ${category.name}, ${category.kind},
            ${category.sortOrder})
    on conflict (code) do update
      set name = excluded.name, kind = excluded.kind, sort_order = excluded.sort_order
    returning id`)
  return row!.id
}

main()
  .catch((error: unknown) => {
    console.error('Сид не отработал:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => closeDb())

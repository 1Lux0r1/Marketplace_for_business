import { sql } from 'drizzle-orm'
import { config } from '@/shared/config'
import { closeDb, getDb } from '@/shared/db'
import { uuidv7 } from '@/shared/id'
import * as platform from '@/modules/platform'
import * as catalog from '@/modules/catalog'
import { CATEGORIES, CONTRACTORS, LISTINGS, type CategorySeed } from './demo-catalogue'

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
 * Сами данные лежат в `demo-catalogue.ts`: их же показывает витрина демо
 * на GitHub Pages, где базы нет. Одна копия на двоих — иначе демо и база
 * разошлись бы молча.
 *
 * Запускать: `pnpm db:seed`. Повторный запуск безопасен — сначала чистит
 * то, что засеял, и засевает заново.
 */

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

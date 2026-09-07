import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { getDb } from '@/shared/db'
import { uuidv7 } from '@/shared/id'
import * as platform from '@/modules/platform'
import {
  categories,
  contractorCategories,
  contractors,
  coverageZones,
  listingZones,
  listings,
} from './schema'
import { errors } from './errors'
import { findZone, isKnownZone, coveringCodes } from './zones'
import type {
  Category,
  Contractor,
  ContractorCard,
  ContractorStatus,
  Listing,
  SearchResult,
  StorefrontListing,
  Zone,
} from './types'

/**
 * Категории, подрядчики, зоны и карточки каталога.
 *
 * НИ ОДНОГО запроса к таблицам схемы `platform` здесь нет и быть не может:
 * про существование компании модуль спрашивает у соседа через его публичный
 * интерфейс (§4.2, §4.4). Это и есть та граница, ради которой потом можно
 * будет вынести модули в отдельные сервисы, а не переписывать.
 */

/**
 * «Сильные первыми».
 *
 * `nulls last` здесь обязателен: PostgreSQL при сортировке по убыванию ставит
 * пустые значения ПЕРВЫМИ, и без этой оговорки подрядчик, которого ещё никто
 * не оценивал, оказывался впереди пятизвёздочного — и в списке оператора,
 * и в предложении заказчику.
 */
const byStrength = sql`${contractors.manualRating} desc nulls last`

// ─── Категории ──────────────────────────────────────────────────────────

export async function listCategories(options: { activeOnly?: boolean } = {}): Promise<Category[]> {
  const db = getDb()
  const rows = await db
    .select()
    .from(categories)
    .where(options.activeOnly ? eq(categories.isActive, true) : undefined)
    .orderBy(asc(categories.sortOrder), asc(categories.name))
  return rows.map(toCategory)
}

export async function getCategory(id: string): Promise<Category> {
  const db = getDb()
  const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1)
  if (!row) throw errors.categoryNotFound()
  return toCategory(row)
}

export async function getCategoryByCode(code: string): Promise<Category> {
  const db = getDb()
  const [row] = await db.select().from(categories).where(eq(categories.code, code)).limit(1)
  if (!row) throw errors.categoryNotFound()
  return toCategory(row)
}

// ─── Подрядчики ─────────────────────────────────────────────────────────

/**
 * Завести подрядчика.
 *
 * Компания должна существовать — проверяем вызовом соседа, а не внешним ключом:
 * между схемами их нет (§4.3). Ошибка при этом человеческая, а не «нарушение
 * ограничения внешнего ключа».
 */
export async function createContractor(input: {
  orgId: string
  status?: ContractorStatus
  manualRating?: number | undefined
  notes?: string | undefined
}): Promise<Contractor> {
  try {
    await platform.getOrg(input.orgId)
  } catch {
    throw errors.orgNotFound()
  }

  const db = getDb()
  try {
    const [row] = await db
      .insert(contractors)
      .values({
        id: uuidv7(),
        orgId: input.orgId,
        status: input.status ?? 'draft',
        manualRating: input.manualRating ?? null,
        notes: input.notes?.trim() || null,
      })
      .returning()
    return toContractor(row!)
  } catch (error: unknown) {
    if (isUniqueViolation(error, 'contractors_org_key')) throw errors.orgAlreadyContractor()
    throw error
  }
}

export async function getContractor(id: string): Promise<ContractorCard> {
  const db = getDb()
  const [row] = await db.select().from(contractors).where(eq(contractors.id, id)).limit(1)
  if (!row) throw errors.contractorNotFound()

  const [assigned, zones] = await Promise.all([
    db
      .select({ category: categories })
      .from(contractorCategories)
      .innerJoin(categories, eq(categories.id, contractorCategories.categoryId))
      .where(eq(contractorCategories.contractorId, id))
      .orderBy(asc(categories.sortOrder)),
    db.select().from(coverageZones).where(eq(coverageZones.contractorId, id)),
  ])

  return {
    ...toContractor(row),
    categories: assigned.map((r) => toCategory(r.category)),
    zones: zones.map((z) => ({ code: z.code, name: z.name, kind: z.kind as Zone['kind'] })),
  }
}

export async function findContractorByOrg(orgId: string): Promise<Contractor | null> {
  const db = getDb()
  const [row] = await db.select().from(contractors).where(eq(contractors.orgId, orgId)).limit(1)
  return row ? toContractor(row) : null
}

export async function listContractors(
  filter: { status?: ContractorStatus | undefined; categoryId?: string | undefined } = {},
): Promise<Contractor[]> {
  const db = getDb()

  const conditions = []
  if (filter.status) conditions.push(eq(contractors.status, filter.status))
  if (filter.categoryId) {
    conditions.push(
      sql`exists (
        select 1 from catalog.contractor_categories cc
        where cc.contractor_id = ${contractors.id} and cc.category_id = ${filter.categoryId}
      )`,
    )
  }

  const rows = await db
    .select()
    .from(contractors)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(byStrength, asc(contractors.createdAt))
  return rows.map(toContractor)
}

export async function setContractorStatus(
  id: string,
  status: ContractorStatus,
): Promise<Contractor> {
  const db = getDb()
  const [row] = await db
    .update(contractors)
    .set({ status })
    .where(eq(contractors.id, id))
    .returning()
  if (!row) throw errors.contractorNotFound()
  return toContractor(row)
}

/** Категории подрядчика задаются списком целиком, а не по одной. */
export async function setContractorCategories(
  contractorId: string,
  categoryIds: string[],
): Promise<void> {
  const db = getDb()
  await getContractorRow(contractorId)

  if (categoryIds.length > 0) {
    const found = await db
      .select({ id: categories.id })
      .from(categories)
      .where(inArray(categories.id, categoryIds))
    if (found.length !== new Set(categoryIds).size) throw errors.categoryNotFound()
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(contractorCategories)
      .where(eq(contractorCategories.contractorId, contractorId))
    if (categoryIds.length === 0) return
    await tx
      .insert(contractorCategories)
      .values([...new Set(categoryIds)].map((categoryId) => ({ contractorId, categoryId })))
  })
}

/**
 * Зоны подрядчика задаются списком целиком.
 *
 * Коды проверяются по справочнику из `zones.ts`: набранная руками зона,
 * которой нет в списке, не должна попадать в базу — иначе подбор по зоне
 * перестанет находить этого подрядчика, и никто не поймёт почему.
 */
export async function setContractorZones(contractorId: string, codes: string[]): Promise<void> {
  const db = getDb()
  await getContractorRow(contractorId)

  const unique = [...new Set(codes)]
  for (const code of unique) {
    if (!isKnownZone(code)) throw errors.unknownZone(code)
  }

  await db.transaction(async (tx) => {
    await tx.delete(coverageZones).where(eq(coverageZones.contractorId, contractorId))
    if (unique.length === 0) return
    await tx.insert(coverageZones).values(
      unique.map((code) => {
        const zone = findZone(code)!
        return { id: uuidv7(), contractorId, kind: zone.kind, code: zone.code, name: zone.name }
      }),
    )
  })
}

// ─── Отбор кандидатов ───────────────────────────────────────────────────

/**
 * Кого позвать на заявку в этой категории и зоне.
 *
 * Правила отбора: подрядчик активен, у него есть эта категория, он покрывает
 * эту зону. Сортировка — по ручному рейтингу, потом по давности.
 *
 * Это **не заглушка**: когда появится ИИ-сервис, он будет предлагать свой
 * порядок, а эта функция останется запасным путём на случай, когда сервис
 * молчит или отвечает неуверенно. Поэтому написана как настоящая.
 */
export async function findCandidates(input: {
  categoryId: string
  zoneCode: string
  limit?: number
}): Promise<Contractor[]> {
  const db = getDb()
  if (!isKnownZone(input.zoneCode)) throw errors.unknownZone(input.zoneCode)

  // Зона города покрывает свои округа: тот, кто работает по всей Москве,
  // должен находиться и по запросу «Центральный округ»
  const zones = coveringCodes(input.zoneCode)

  const rows = await db
    .select()
    .from(contractors)
    .where(
      and(
        eq(contractors.status, 'active'),
        sql`exists (
          select 1 from catalog.contractor_categories cc
          where cc.contractor_id = ${contractors.id} and cc.category_id = ${input.categoryId}
        )`,
        sql`exists (
          select 1 from catalog.coverage_zones cz
          where cz.contractor_id = ${contractors.id} and cz.code in ${zones}
        )`,
      ),
    )
    .orderBy(byStrength, asc(contractors.createdAt))
    .limit(input.limit ?? 10)

  return rows.map(toContractor)
}

// ─── Карточки каталога ──────────────────────────────────────────────────

export async function createListing(input: {
  contractorId: string
  categoryId: string
  title: string
  description?: string | undefined
  unit: string
  priceKopecks: bigint
  minQty?: string | undefined
  leadTimeHours?: number | undefined
  status?: Listing['status'] | undefined
}): Promise<Listing> {
  if (input.priceKopecks <= 0n) throw errors.badPrice()
  await getContractorRow(input.contractorId)
  await getCategory(input.categoryId)

  const db = getDb()
  const status = input.status ?? 'draft'
  const [row] = await db
    .insert(listings)
    .values({
      id: uuidv7(),
      contractorId: input.contractorId,
      categoryId: input.categoryId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      unit: input.unit.trim(),
      priceKopecks: input.priceKopecks,
      minQty: input.minQty ?? '1',
      leadTimeHours: input.leadTimeHours ?? null,
      status,
      publishedAt: status === 'published' ? new Date() : null,
    })
    .returning()
  return toListing(row!)
}

export async function listListings(
  filter: { status?: Listing['status'] | undefined; categoryId?: string | undefined } = {},
): Promise<Listing[]> {
  const db = getDb()
  const conditions = []
  if (filter.status) conditions.push(eq(listings.status, filter.status))
  if (filter.categoryId) conditions.push(eq(listings.categoryId, filter.categoryId))

  const rows = await db
    .select()
    .from(listings)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(listings.priceKopecks))
  return rows.map(toListing)
}

// ─── Мелочи ─────────────────────────────────────────────────────────────

async function getContractorRow(id: string) {
  const db = getDb()
  const [row] = await db.select().from(contractors).where(eq(contractors.id, id)).limit(1)
  if (!row) throw errors.contractorNotFound()
  return row
}

function toCategory(row: typeof categories.$inferSelect): Category {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    kind: row.kind as Category['kind'],
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  }
}

function toContractor(row: typeof contractors.$inferSelect): Contractor {
  return {
    id: row.id,
    orgId: row.orgId,
    status: row.status as ContractorStatus,
    manualRating: row.manualRating,
    notes: row.notes,
    createdAt: row.createdAt,
  }
}

function toListing(row: typeof listings.$inferSelect): Listing {
  return {
    id: row.id,
    contractorId: row.contractorId,
    categoryId: row.categoryId,
    title: row.title,
    description: row.description,
    unit: row.unit,
    priceKopecks: row.priceKopecks,
    minQty: row.minQty,
    leadTimeHours: row.leadTimeHours,
    status: row.status as Listing['status'],
    publishedAt: row.publishedAt,
  }
}

/** Drizzle заворачивает ошибку драйвера, код и ограничение лежат в `cause`. */
function isUniqueViolation(error: unknown, constraint: string): boolean {
  let current: unknown = error
  for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth += 1) {
    const e = current as { code?: string; constraint_name?: string; cause?: unknown }
    if (e.code === '23505' && e.constraint_name === constraint) return true
    current = e.cause
  }
  return false
}

// ─── Витрина ────────────────────────────────────────────────────────────

/**
 * Поиск по витрине: то, что видит клиент.
 *
 * Видны ТОЛЬКО опубликованные карточки — `draft`, `pending` и `rejected`
 * это внутренняя кухня модерации, клиенту её показывать нельзя.
 *
 * Поиск по строке — простое совпадение, без полнотекстового индекса.
 * На первой сотне карточек разницы нет, а индекс это отдельная работа
 * и отдельное обслуживание.
 *
 * Зона карточки: если у карточки свои зоны не заданы, работают зоны
 * подрядчика. Пустой список у карточки означает «везде, где работает он»,
 * а не «нигде».
 */
export async function searchListings(input: {
  categoryId?: string | undefined
  zoneCode?: string | undefined
  query?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}): Promise<SearchResult> {
  const db = getDb()

  if (input.zoneCode && !isKnownZone(input.zoneCode)) throw errors.unknownZone(input.zoneCode)
  const zones = input.zoneCode ? coveringCodes(input.zoneCode) : null

  const limit = Math.min(Math.max(input.limit ?? 24, 1), 100)
  const offset = Math.max(input.offset ?? 0, 0)
  const text = input.query?.trim()

  const conditions = [
    eq(listings.status, 'published'),
    eq(contractors.status, 'active'),
  ]
  if (input.categoryId) conditions.push(eq(listings.categoryId, input.categoryId))
  if (text) {
    const pattern = `%${text.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`
    conditions.push(
      sql`(${listings.title} ilike ${pattern} or coalesce(${listings.description}, '') ilike ${pattern})`,
    )
  }
  if (zones) {
    conditions.push(sql`(
      case
        when exists (select 1 from catalog.listing_zones lz where lz.listing_id = ${listings.id})
          then exists (
            select 1 from catalog.listing_zones lz
            where lz.listing_id = ${listings.id} and lz.zone_code in ${zones})
        else exists (
          select 1 from catalog.coverage_zones cz
          where cz.contractor_id = ${contractors.id} and cz.code in ${zones})
      end)`)
  }

  const where = and(...conditions)

  const [rows, [counted]] = await Promise.all([
    db
      .select({
        listing: listings,
        categoryName: categories.name,
        contractorOrgId: contractors.orgId,
        contractorRating: contractors.manualRating,
      })
      .from(listings)
      .innerJoin(contractors, eq(contractors.id, listings.contractorId))
      .innerJoin(categories, eq(categories.id, listings.categoryId))
      .where(where)
      .orderBy(byStrength, asc(listings.priceKopecks))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(listings)
      .innerJoin(contractors, eq(contractors.id, listings.contractorId))
      .where(where),
  ])

  const items = await withZones(rows)
  return { items, total: counted?.total ?? 0 }
}

/** Одна карточка витрины по её номеру. Черновики и снятые не отдаются. */
export async function getStorefrontListing(id: string): Promise<StorefrontListing> {
  const db = getDb()
  const rows = await db
    .select({
      listing: listings,
      categoryName: categories.name,
      contractorOrgId: contractors.orgId,
      contractorRating: contractors.manualRating,
    })
    .from(listings)
    .innerJoin(contractors, eq(contractors.id, listings.contractorId))
    .innerJoin(categories, eq(categories.id, listings.categoryId))
    .where(
      and(
        eq(listings.id, id),
        eq(listings.status, 'published'),
        eq(contractors.status, 'active'),
      ),
    )
    .limit(1)

  const [item] = await withZones(rows)
  if (!item) throw errors.listingNotFound()
  return item
}

type StorefrontRow = {
  listing: typeof listings.$inferSelect
  categoryName: string
  contractorOrgId: string
  contractorRating: number | null
}

/** Зоны для пачки карточек: своими, а если своих нет — зонами подрядчика. */
async function withZones(rows: StorefrontRow[]): Promise<StorefrontListing[]> {
  if (rows.length === 0) return []
  const db = getDb()

  const listingIds = rows.map((r) => r.listing.id)
  const contractorIds = [...new Set(rows.map((r) => r.listing.contractorId))]

  const [own, byContractor] = await Promise.all([
    db.select().from(listingZones).where(inArray(listingZones.listingId, listingIds)),
    db.select().from(coverageZones).where(inArray(coverageZones.contractorId, contractorIds)),
  ])

  const ownByListing = new Map<string, string[]>()
  for (const row of own) {
    ownByListing.set(row.listingId, [...(ownByListing.get(row.listingId) ?? []), row.zoneCode])
  }
  const byContractorMap = new Map<string, string[]>()
  for (const row of byContractor) {
    byContractorMap.set(row.contractorId, [
      ...(byContractorMap.get(row.contractorId) ?? []),
      row.code,
    ])
  }

  return rows.map((row) => ({
    id: row.listing.id,
    title: row.listing.title,
    description: row.listing.description,
    unit: row.listing.unit,
    priceKopecks: row.listing.priceKopecks,
    minQty: row.listing.minQty,
    leadTimeHours: row.listing.leadTimeHours,
    categoryId: row.listing.categoryId,
    categoryName: row.categoryName,
    contractorId: row.listing.contractorId,
    contractorOrgId: row.contractorOrgId,
    contractorRating: row.contractorRating,
    zones: ownByListing.get(row.listing.id) ?? byContractorMap.get(row.listing.contractorId) ?? [],
  }))
}

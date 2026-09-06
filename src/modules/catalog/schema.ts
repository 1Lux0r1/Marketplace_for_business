import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  numeric,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Схема `catalog` — что и кем продаётся: категории, подрядчики, их зоны
 * и карточки услуг.
 *
 * Главная межмодульная граница здесь — `contractors.org_id`. Он указывает
 * на `platform.orgs`, но внешнего ключа НЕТ и быть не должно (§4.3):
 * иначе выделить модули в отдельные сервисы можно будет только с переносом
 * данных. Целостность проверяет код: перед заведением подрядчика `catalog`
 * спрашивает у `platform`, есть ли такая компания.
 *
 * Внутри своей схемы внешние ключи, наоборот, обязательны.
 */
export const catalog = pgSchema('catalog')

export const categories = catalog.table(
  'categories',
  {
    id: uuid('id').primaryKey(),
    code: text('code').notNull(),
    parentId: uuid('parent_id'),
    name: text('name').notNull(),
    kind: text('kind').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(100),
  },
  (t) => [
    uniqueIndex('categories_code_key').on(t.code),
    check('categories_kind', sql`${t.kind} in ('service','goods')`),
  ],
)

export const contractors = catalog.table(
  'contractors',
  {
    id: uuid('id').primaryKey(),
    // Ссылка на platform.orgs без внешнего ключа — это межмодульная граница
    orgId: uuid('org_id').notNull(),
    status: text('status').notNull(),
    manualRating: integer('manual_rating'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('contractors_org_key').on(t.orgId),
    index('contractors_status_idx').on(t.status),
    check('contractors_status', sql`${t.status} in ('draft','active','paused','blocked')`),
    check(
      'contractors_rating',
      sql`${t.manualRating} is null or ${t.manualRating} between 1 and 5`,
    ),
  ],
)

export const contractorCategories = catalog.table(
  'contractor_categories',
  {
    contractorId: uuid('contractor_id')
      .notNull()
      .references(() => contractors.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
  },
  (t) => [primaryKey({ columns: [t.contractorId, t.categoryId] })],
)

export const coverageZones = catalog.table(
  'coverage_zones',
  {
    id: uuid('id').primaryKey(),
    contractorId: uuid('contractor_id')
      .notNull()
      .references(() => contractors.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    code: text('code').notNull(),
    name: text('name').notNull(),
  },
  (t) => [
    index('coverage_zones_code_idx').on(t.code),
    uniqueIndex('coverage_zones_unique').on(t.contractorId, t.code),
    check('coverage_zones_kind', sql`${t.kind} in ('district','city')`),
  ],
)

/**
 * Карточка каталога: что подрядчик продаёт.
 *
 * Основной путь клиента — выбрать карточку, а не оставить заявку (§1).
 *
 * `price_kopecks` — цена за одну единицу `unit`, в копейках (§6). Это оферта
 * подрядчика, поэтому в сделку она КОПИРУЕТСЯ в момент создания, а не читается
 * по ссылке: подрядчик вправе поменять цену завтра, а сделка вчерашняя.
 * То же с названием и единицей — сделка хранит снимок, каталог хранит текущее.
 *
 * `status` — это модерация, а не витрина: `draft` пишет подрядчик,
 * `pending` ждёт оператора, `published` видно клиентам, `rejected` возвращено
 * с пояснением, `archived` снято подрядчиком.
 */
export const listings = catalog.table(
  'listings',
  {
    id: uuid('id').primaryKey(),
    contractorId: uuid('contractor_id')
      .notNull()
      .references(() => contractors.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    title: text('title').notNull(),
    description: text('description'),
    unit: text('unit').notNull(),
    priceKopecks: bigint('price_kopecks', { mode: 'bigint' }).notNull(),
    minQty: numeric('min_qty', { precision: 12, scale: 3 }).notNull().default('1'),
    leadTimeHours: integer('lead_time_hours'),
    status: text('status').notNull().default('draft'),
    rejectionNote: text('rejection_note'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('listings_status_category_idx').on(t.status, t.categoryId),
    index('listings_contractor_idx').on(t.contractorId, t.status),
    // Частичный индекс держит витрину быстрой, когда снятых карточек
    // станет больше, чем живых
    index('listings_published_price_idx')
      .on(t.categoryId, t.priceKopecks)
      .where(sql`${t.status} = 'published'`),
    check('listings_price', sql`${t.priceKopecks} > 0`),
    check(
      'listings_status',
      sql`${t.status} in ('draft','pending','published','rejected','archived')`,
    ),
  ],
)

/**
 * Зоны карточки — подмножество зон подрядчика. Пусто означает «все его зоны».
 *
 * Ссылки на `coverage_zones` намеренно нет: одна карточка может работать
 * не во всех зонах подрядчика. Проверка «зона карточки входит в зоны
 * подрядчика» делается кодом при публикации.
 */
export const listingZones = catalog.table(
  'listing_zones',
  {
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    zoneCode: text('zone_code').notNull(),
  },
  (t) => [primaryKey({ columns: [t.listingId, t.zoneCode] })],
)

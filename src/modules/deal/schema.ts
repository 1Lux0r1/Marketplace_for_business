import { sql } from 'drizzle-orm'
import {
  bigint,
  bigserial,
  check,
  index,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Схема `deal` — сделка. Ядро домена и то, за что берётся комиссия (§1).
 *
 * У сделки два входа и один общий путь: из каталога (клиент выбрал карточку)
 * и из заявки (подрядчики ответили, клиент выбрал вариант). Дальше оба идут
 * одинаково, и это не случайность: сопровождение не должно зависеть от того,
 * как сделка возникла.
 */
export const deal = pgSchema('deal')

/**
 * ВСЕ статусы сделки, включая `disputed` и `cancelled`.
 *
 * Они здесь с самого начала по требованию §8, и причина не в аккуратности:
 * разбор рекламаций и есть та гарантия, за которую берётся комиссия. Площадка
 * без `disputed` — это каталог, а каталог копируется за месяц.
 *
 * Добавлять статус потом — это менять данные во всех существующих сделках,
 * поэтому список полный сразу, даже там, где переход ещё не написан.
 */
export const DEAL_STATUSES = [
  'new',
  'matching',
  'quoted',
  'accepted',
  'paid',
  'in_progress',
  'act_issued',
  'act_signed',
  'completed',
  'disputed',
  'cancelled',
] as const

export const deals = deal.table(
  'deals',
  {
    id: uuid('id').primaryKey(),
    /** Номер, который называют вслух: «сделка №1240». Последовательность в базе. */
    number: bigint('number', { mode: 'number' })
      .notNull()
      .default(sql`nextval('deal.deal_number')`),

    /**
     * Откуда сделка взялась — ЯВНЫМ полем, а не выводится из того, какие
     * ссылки заполнены. От происхождения зависят разрешённые переходы:
     * `new → accepted` можно только из каталога, `new → matching` — только
     * из заявки. Перепутать их значит дать клиенту зафиксировать цену,
     * которой никто не называл.
     */
    source: text('source').notNull(),

    clientOrgId: uuid('client_org_id').notNull(),
    contractorId: uuid('contractor_id'),
    /** Ссылок между схемами не бывает (§4.3) — целостность держит код. */
    listingId: uuid('listing_id'),
    requestId: uuid('request_id'),
    siteId: uuid('site_id'),

    status: text('status').notNull().default('new'),

    /**
     * Цена — СНИМКОМ с карточки на момент создания, а не ссылкой на неё.
     * Цена в карточке это оферта подрядчика: он вправе её изменить завтра,
     * и это не должно менять уже заключённую сделку.
     */
    priceKopecks: bigint('price_kopecks', { mode: 'bigint' }),
    qty: numeric('qty'),
    unit: text('unit'),
    title: text('title'),

    /**
     * Ставка комиссии и ПРИЧИНА, по которой она такая, — тоже снимком.
     * Через полгода придётся ответить подрядчику или проверяющему, почему
     * здесь взяли 1 %, а в соседней сделке 13 %. «Так посчиталось» не годится:
     * пороги к тому времени будут уже другие (`docs/10-commission-rates.md`).
     *
     * Пустые, пока не появится модуль `payments`: сделка без ставки — это
     * сделка, по которой ещё не считали деньги, а не сделка со ставкой ноль.
     */
    commissionRate: numeric('commission_rate'),
    commissionReason: text('commission_reason'),
    commissionKopecks: bigint('commission_kopecks', { mode: 'bigint' }),
    ratedAt: timestamp('rated_at', { withTimezone: true }),

    /** Адрес — снимком с точки: точку переименуют, а сделка помнит, куда ехали. */
    address: text('address'),
    zoneCode: text('zone_code'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** Когда сделка пришла в свой нынешний статус: возраст очереди считают по нему. */
    statusAt: timestamp('status_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('deals_source', sql`${t.source} in ('catalog','request')`),
    check(
      'deals_status',
      sql`${t.status} in ('new','matching','quoted','accepted','paid','in_progress','act_issued','act_signed','completed','disputed','cancelled')`,
    ),
    // Деньги — всегда целые копейки и никогда не отрицательные (§6)
    check('deals_price', sql`${t.priceKopecks} is null or ${t.priceKopecks} >= 0`),
    check(
      'deals_commission',
      sql`${t.commissionKopecks} is null or ${t.commissionKopecks} >= 0`,
    ),
    /**
     * Сделка из каталога обязана знать карточку, сделка из заявки — заявку.
     * Это то самое «происхождение хранится явно», но проверенное базой:
     * код можно обойти, ограничение — нет.
     */
    check(
      'deals_origin',
      sql`(${t.source} = 'catalog' and ${t.listingId} is not null)
          or (${t.source} = 'request' and ${t.requestId} is not null)`,
    ),
    index('deals_client_idx').on(t.clientOrgId, sql`${t.createdAt} desc`),
    index('deals_contractor_idx').on(t.contractorId, sql`${t.createdAt} desc`),
    index('deals_queue_idx').on(t.status, t.statusAt),
  ],
)

export const dealNumber = deal.sequence('deal_number', { startWith: 1000 })

/**
 * Что происходило со сделкой: каждый переход статуса и кто его сделал.
 *
 * Это не журнал администратора (тот про то, кто менял правила), а история
 * самой сделки: её читают клиент, подрядчик и оператор при разборе спора.
 * Поэтому она живёт здесь, а не в `admin`.
 */
export const dealEvents = deal.table(
  'deal_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    dealId: uuid('deal_id')
      .notNull()
      .references(() => deals.id, { onDelete: 'cascade' }),
    fromStatus: text('from_status'),
    toStatus: text('to_status').notNull(),
    /** Кто перевёл. `null` — перевела сама система, по оплате или по таймеру. */
    actorId: uuid('actor_id'),
    actorName: text('actor_name'),
    /** Зачем: обязательно для отмены и рекламации — это читают при разборе. */
    reason: text('reason'),
    payload: jsonb('payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('deal_events_idx').on(t.dealId, t.id)],
)

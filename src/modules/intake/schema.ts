import { sql } from 'drizzle-orm'
import {
  bigint,
  bigserial,
  check,
  index,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Схема `intake` — приём заявки. Второй путь клиента (§1): нестандартная
 * задача, под которую нет готовой карточки в каталоге.
 *
 * Заявка — ещё не сделка. Это описание задачи, по которому подрядчики дадут
 * цену и срок. Сделка появится, когда клиент выберет вариант.
 */
export const intake = pgSchema('intake')

/**
 * Номер заявки — последовательностью в базе, а не счётчиком в коде.
 *
 * ОТСТУПЛЕНИЕ ОТ `docs/03-data-model.md`, где номера нет вовсе. Критерий
 * приёмки 03-5 требует показать клиенту «подтверждение с номером заявки»,
 * а машинный идентификатор человеку не номер: его не продиктовать по телефону
 * и не найти глазами в письме. Правило §8 про нумерацию счетов и актов
 * действует здесь по той же причине — номер называют вслух.
 *
 * Пропуски последовательность допускает (откат транзакции номер не вернёт),
 * и это осознанно: у счетов и актов пропуск недопустим по закону, у заявки
 * такого требования нет, а уникальность и возрастание — есть.
 */
export const requestNumber = intake.sequence('request_number', { startWith: 1000 })

export const requests = intake.table(
  'requests',
  {
    id: uuid('id').primaryKey(),
    /** Что человек называет номером: «заявка №1240». */
    number: bigint('number', { mode: 'number' })
      .notNull()
      .default(sql`nextval('intake.request_number')`),

    /** Ссылок между схемами не бывает (§4.3) — целостность держит код. */
    clientOrgId: uuid('client_org_id').notNull(),
    /** Кто оставил. `null` у заявки из бота, где человек ещё не опознан. */
    createdBy: uuid('created_by'),
    /** Точка клиента: `platform.org_sites`. Из неё же берётся зона. */
    siteId: uuid('site_id'),

    source: text('source').notNull(),
    /** Что написал клиент своими словами. Главное поле заявки. */
    rawText: text('raw_text'),
    categoryId: uuid('category_id'),
    urgency: text('urgency').notNull().default('normal'),

    /**
     * Адрес и зона — снимком с точки на момент заявки.
     *
     * Точку переименуют, перенесут или уберут в архив, а заявка обязана
     * помнить, куда именно ехали. Ссылка на точку рядом остаётся: по ней
     * видно, та же это точка или другая.
     */
    address: text('address'),
    zoneCode: text('zone_code'),

    contactName: text('contact_name'),
    contactPhone: text('contact_phone'),
    desiredAt: timestamp('desired_at', { withTimezone: true }),

    status: text('status').notNull().default('new'),

    /**
     * Чем разобрана заявка и с какой уверенностью. Заполняется всегда,
     * с первой заявки: по этому потом считается, насколько модель лучше
     * правил, и это цифра для отчёта по гранту.
     */
    parseSource: text('parse_source'),
    parseMeta: jsonb('parse_meta'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Допустимые значения держит база, а не только код: заявку заводит
    // и веб-форма, и бот, и оператор — мест, где можно ошибиться, три
    check('requests_source', sql`${t.source} in ('web','telegram','operator')`),
    check('requests_urgency', sql`${t.urgency} in ('normal','urgent','planned')`),
    check('requests_status', sql`${t.status} in ('new','parsed','converted','rejected')`),
    check(
      'requests_parse_source',
      sql`${t.parseSource} is null or ${t.parseSource} in ('ai','rules','operator')`,
    ),
    index('requests_queue_idx').on(t.status, t.createdAt),
    index('requests_client_idx').on(t.clientOrgId, sql`${t.createdAt} desc`),
  ],
)

/**
 * Что происходило с заявкой. Отдельной таблицей, а не колонками: шагов
 * со временем станет больше, и каждый новый не должен менять структуру.
 */
export const requestEvents = intake.table(
  'request_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => requests.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('request_events_idx').on(t.requestId, t.id)],
)

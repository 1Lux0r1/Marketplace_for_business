import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Схема `documents` — договор, счёт, акт.
 *
 * Это не бумажки, а то, на чём держится гарант: без подписанного акта деньги
 * подрядчику не уходят (§1, §8), а «подписанного акта» не бывает без самого
 * акта. Пока документов не было, приёмка оставалась нажатием кнопки.
 */
export const documents = pgSchema('documents')

export const DOCUMENT_KINDS = ['contract', 'invoice', 'act'] as const
export const DOCUMENT_STATUSES = ['issued', 'signed', 'void'] as const
/** Электронно — подписью в системе; бумагой — скан и подтверждение оператором. */
export const SIGNING_PATHS = ['electronic', 'paper'] as const

/**
 * Счётчик номеров. ОТДЕЛЬНАЯ ТАБЛИЦА, А НЕ ПОСЛЕДОВАТЕЛЬНОСТЬ, и это важно.
 *
 * §8 требует нумерацию счетов и актов «без пропусков и дублей». Обычная
 * последовательность в базе даёт уникальность, но НЕ даёт отсутствие
 * пропусков: откат транзакции номер не возвращает, и в нумерации появляется
 * дырка. Для счетов это вопрос не аккуратности, а объяснений бухгалтеру
 * и проверяющему.
 *
 * Поэтому номер берётся из строки под блокировкой: она задерживает
 * одновременную выдачу, зато не пропускает и не дублирует. Цена решения —
 * выдача документов идёт по одному; при наших объёмах это незаметно,
 * а при тысячах документов в минуту придётся вернуться.
 *
 * Счётчик свой на каждый вид и год: счета нумеруются заново с января,
 * как принято в бухгалтерии.
 */
export const counters = documents.table(
  'counters',
  {
    kind: text('kind').notNull(),
    year: integer('year').notNull(),
    next: integer('next').notNull().default(1),
  },
  (t) => [
    uniqueIndex('counters_key').on(t.kind, t.year),
    check('counters_kind', sql`${t.kind} in ('contract','invoice','act')`),
  ],
)

export const docs = documents.table(
  'documents',
  {
    id: uuid('id').primaryKey(),
    /** Человеческий номер: «СЧ-2026-000123». Его называют и ищут глазами. */
    number: text('number').notNull(),
    kind: text('kind').notNull(),

    /** Ссылок между схемами не бывает (§4.3) — целостность держит код. */
    dealId: uuid('deal_id').notNull(),
    clientOrgId: uuid('client_org_id').notNull(),
    contractorId: uuid('contractor_id'),

    status: text('status').notNull().default('issued'),
    signingPath: text('signing_path').notNull(),

    /** Сумма документа в копейках (§6). У договора её нет. */
    amountKopecks: bigint('amount_kopecks', { mode: 'bigint' }),

    /**
     * СНИМОК всего, из чего документ собран: реквизиты сторон, позиции, суммы.
     * Не ссылки. Компанию переименуют, цену в каталоге изменят, а выданный
     * документ обязан остаться тем, что подписали.
     */
    data: jsonb('data').notNull(),
    /** Готовый вид документа. Хранится вместе с данными по той же причине. */
    html: text('html').notNull(),

    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    signedAt: timestamp('signed_at', { withTimezone: true }),
    /** Кто отметил подписанным. На бумажном пути это всегда оператор. */
    signedBy: uuid('signed_by'),
    /**
     * Чем подтверждена подпись: ответ оператора ЭДО или отметка оператора
     * площадки со ссылкой на скан. Через полгода придётся объяснить,
     * на основании чего документ считается подписанным.
     */
    signature: jsonb('signature'),

    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidReason: text('void_reason'),
  },
  (t) => [
    check('documents_kind', sql`${t.kind} in ('contract','invoice','act')`),
    check('documents_status', sql`${t.status} in ('issued','signed','void')`),
    check('documents_path', sql`${t.signingPath} in ('electronic','paper')`),
    check(
      'documents_amount',
      sql`${t.amountKopecks} is null or ${t.amountKopecks} >= 0`,
    ),
    /** Номер уникален — это половина требования §8; вторая половина в счётчике. */
    uniqueIndex('documents_number_key').on(t.number),
    index('documents_deal_idx').on(t.dealId, t.issuedAt),
    index('documents_client_idx').on(t.clientOrgId, sql`${t.issuedAt} desc`),
  ],
)

import { sql } from 'drizzle-orm'
import { index, integer, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * Схема `notifications` — что мы отправили, кому и чем это кончилось.
 *
 * Журнал нужен не для красоты: когда человек говорит «письмо не пришло»,
 * без него нельзя отличить «не отправили» от «отправили, но не дошло».
 */
export const notifications = pgSchema('notifications')

export const messages = notifications.table(
  'messages',
  {
    id: uuid('id').primaryKey(),
    channel: text('channel').notNull(),
    // Кому: адрес почты или идентификатор в Telegram
    address: text('address').notNull(),
    template: text('template').notNull(),
    subject: text('subject'),
    status: text('status').notNull().default('queued'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    // Ссылка на сделку или заявку, если письмо про неё. Между модулями
    // внешних ключей нет (§4.3): целостность обеспечивает код
    contextId: uuid('context_id'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('messages_address_idx').on(t.address, t.createdAt),
    index('messages_context_idx').on(t.contextId).where(sql`${t.contextId} is not null`),
    index('messages_failed_idx').on(t.createdAt).where(sql`${t.status} = 'failed'`),
  ],
)

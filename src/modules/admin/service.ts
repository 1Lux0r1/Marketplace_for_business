import { and, desc, eq, sql } from 'drizzle-orm'
import { getDb, type Executor } from '@/shared/db'
import { uuidv7 } from '@/shared/id'
import { auditLog } from './schema'
import { errors } from './errors'
import type { Actor, Change, ChangeFilter, ChangePage } from './types'

/**
 * Журнал изменений: запись и чтение. Правки и удаления здесь нет — намеренно.
 *
 * Модуль НИЧЕГО не импортирует из других модулей, и это не случайность,
 * а условие его существования. В него пишут почти все: `catalog`, когда
 * оператор меняет подрядчика, `platform`, когда блокируют компанию.
 * Импортируй `admin` их в ответ — вышло бы кольцо, и выносить его потом
 * пришлось бы вместе с половиной системы.
 *
 * Поэтому чужие команды `admin` не вызывает: администратор блокирует
 * компанию — это делает `platform`, вызванный из слоя команд формы, а не
 * из этого модуля. Здесь только своя таблица.
 */

const MAX_LIMIT = 200

/**
 * Записать изменение — В ТОЙ ЖЕ ТРАНЗАКЦИИ, что и само изменение.
 *
 * Транзакция приходит снаружи, как и в `publish`: иначе журнал врёт при
 * откате — изменение не состоялось, а запись о нём осталась. Это проверяется
 * тестом, а не внимательностью.
 *
 * Вызывать без транзакции можно, и это осознанно: у части действий изменение
 * и есть одна операция, оборачивать её не во что. Но если операций две,
 * они обязаны быть одной транзакцией.
 */
export async function logChange(
  exec: Executor,
  input: {
    actor: Actor
    action: string
    entity: string
    entityId: string
    entityLabel?: string | undefined
    before?: Record<string, unknown> | null | undefined
    after?: Record<string, unknown> | null | undefined
    reason?: string | undefined
  },
): Promise<void> {
  if (input.action.trim() === '') throw errors.badChange('Не указано, что произошло')
  if (input.entity.trim() === '') throw errors.badChange('Не указано, над чем')

  await exec.insert(auditLog).values({
    id: uuidv7(),
    actorId: input.actor.id,
    // Снимок: человека переименуют или уволят, а журнал обязан читаться через год
    actorName: input.actor.fullName,
    actorRole: input.actor.role,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    entityLabel: input.entityLabel ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    reason: input.reason?.trim() || null,
  })
}

/** Что происходило. Читается с конца: сначала последнее. */
export async function listChanges(filter: ChangeFilter = {}): Promise<ChangePage> {
  const db = getDb()
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), MAX_LIMIT)
  const offset = Math.max(filter.offset ?? 0, 0)

  const conditions = [
    filter.entity ? eq(auditLog.entity, filter.entity) : undefined,
    filter.entityId ? eq(auditLog.entityId, filter.entityId) : undefined,
    filter.actorId ? eq(auditLog.actorId, filter.actorId) : undefined,
    filter.action ? eq(auditLog.action, filter.action) : undefined,
  ].filter((c) => c !== undefined)

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db
    .select()
    .from(auditLog)
    .where(where)
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(limit)
    .offset(offset)

  const [counted] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(auditLog)
    .where(where)

  return { items: rows.map(toChange), total: counted?.total ?? 0 }
}

export async function getChange(id: string): Promise<Change> {
  const [row] = await getDb().select().from(auditLog).where(eq(auditLog.id, id)).limit(1)
  if (!row) throw errors.changeNotFound()
  return toChange(row)
}

type Row = typeof auditLog.$inferSelect

function toChange(row: Row): Change {
  return {
    id: row.id,
    actorId: row.actorId,
    actorName: row.actorName,
    actorRole: row.actorRole,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    entityLabel: row.entityLabel,
    before: (row.before as Record<string, unknown> | null) ?? null,
    after: (row.after as Record<string, unknown> | null) ?? null,
    reason: row.reason,
    createdAt: row.createdAt,
  }
}

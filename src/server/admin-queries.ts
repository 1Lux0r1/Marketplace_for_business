import 'server-only'
import * as admin from '@/modules/admin'
import { requireAdmin, type Access } from '@/server/session'

/**
 * Чтение для экранов администратора.
 *
 * Права проверяются здесь, в каждом запросе, а не в меню (§6). Меню решает,
 * что показать, а не что можно: оператор, набравший адрес админки руками,
 * должен получить отказ, а не экран.
 */

export function isAvailable(): boolean {
  return true
}

/** Проверка прав живёт в `session.ts` — одна на роль (§6). */
export { requireAdmin }
export type AdminAccess = Access

export type ChangeRow = {
  id: string
  who: string
  whoRole: string
  what: string
  target: string
  before: Array<[string, string]>
  after: Array<[string, string]>
  reason: string | null
  when: Date
}

export type ChangesPage = {
  items: ChangeRow[]
  total: number
  limit: number
  offset: number
}

/**
 * Что происходило, словами.
 *
 * Перевод системных имён в человеческие живёт здесь, а не в модуле: модуль
 * пишет то, что произошло, и не обязан знать, как это называют люди. А людям
 * `contractor.verified` не говорит ничего.
 */
const ACTIONS: Record<string, string> = {
  'contractor.registered': 'подрядчик зарегистрировался',
  'contractor.verified': 'подрядчик подтверждён',
  'contractor.rejected': 'подрядчику отказано',
  'contractor.created': 'подрядчик заведён',
  'contractor.updated': 'подрядчик изменён',
  'org.blocked': 'компания заблокирована',
  'org.unblocked': 'компания разблокирована',
  'rate.changed': 'ставка комиссии изменена',
}

const FIELDS: Record<string, string> = {
  status: 'статус',
  manualRating: 'оценка',
  notes: 'заметки',
  verified: 'решение',
  percentBasisPoints: 'ставка',
  categories: 'категории',
  zones: 'зоны',
  innVerified: 'ИНН подтверждён',
  isActive: 'активна',
}

const STATUSES: Record<string, string> = {
  draft: 'черновик',
  active: 'работает',
  paused: 'на паузе',
  blocked: 'заблокирован',
}

export async function changesPage(filter: {
  entity?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}): Promise<ChangesPage> {
  const limit = filter.limit ?? 50
  const offset = filter.offset ?? 0
  const page = await admin.listChanges({ ...filter, limit, offset })

  return {
    items: page.items.map((change) => ({
      id: change.id,
      who: change.actorName,
      whoRole: change.actorRole === 'admin' ? 'администратор' : 'оператор',
      what: ACTIONS[change.action] ?? change.action,
      target: change.entityLabel ?? shortId(change.entityId),
      before: readable(change.before),
      after: readable(change.after),
      reason: change.reason,
      when: change.createdAt,
    })),
    total: page.total,
    limit,
    offset,
  }
}

/** Значения парами «поле — значение», уже словами. */
function readable(values: Record<string, unknown> | null): Array<[string, string]> {
  if (!values) return []
  return Object.entries(values).map(([key, value]) => [
    FIELDS[key] ?? key,
    asWords(key, value),
  ])
}

function asWords(key: string, value: unknown): string {
  if (value === null || value === undefined) return 'не задано'
  if (typeof value === 'boolean') return value ? 'да' : 'нет'
  // Перечисляем, а не считаем: «категории: 3» не отвечает на вопрос,
  // что именно изменилось. Длинные списки обрезаем — журнал читают глазом
  if (Array.isArray(value)) {
    if (value.length === 0) return 'ничего'
    const shown = value.slice(0, 4).map(String).join(', ')
    return value.length > 4 ? `${shown} и ещё ${value.length - 4}` : shown
  }
  if (key === 'status' && typeof value === 'string') return STATUSES[value] ?? value
  return String(value)
}

/** Хвост идентификатора: не название, но всё же зацепка, если названия нет. */
function shortId(id: string): string {
  return `…${id.slice(-6)}`
}

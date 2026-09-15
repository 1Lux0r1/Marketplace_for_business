import 'server-only'
import * as catalog from '@/modules/catalog'
import * as intake from '@/modules/intake'
import * as platform from '@/modules/platform'
import { formatPhone } from '@/shared/phone'
import { requireOperator, requireUser, type Access } from '@/server/session'

/**
 * Чтение для заявок: и клиентских, и очереди оператора.
 *
 * Права проверяет модуль в каждом запросе (§6). Здесь только «кто пришёл»
 * и перевод машинных значений в человеческие: `urgency: 'urgent'` человеку
 * ничего не говорит.
 */

export function isAvailable(): boolean {
  return true
}

/** Проверки прав живут в `session.ts` — одна на роль (§6). */
export { requireOperator, requireUser }
export type { Access }

const URGENCY_WORDS: Record<string, string> = {
  normal: 'В обычном порядке',
  urgent: 'Срочно',
  planned: 'Планово, к дате',
}

const STATUS_WORDS: Record<string, string> = {
  new: 'Ждёт разбора',
  parsed: 'Разобрана',
  converted: 'Стала сделкой',
  rejected: 'Отклонена',
}

export type RequestRow = {
  id: string
  number: number
  title: string
  categoryName: string | null
  urgency: string
  status: string
  statusKind: 'wait' | 'done' | 'stop'
  address: string | null
  zoneName: string | null
  contact: string | null
  companyName: string | null
  desiredAt: Date | null
  createdAt: Date
}

export type RequestsPage = {
  items: RequestRow[]
  total: number
  limit: number
  offset: number
}

/** Заявки клиента: его собственные и только они. */
export async function myRequests(
  user: platform.User,
  options: { limit?: number | undefined; offset?: number | undefined } = {},
): Promise<RequestsPage> {
  const page = await intake.listRequests(user, options)
  return shape(page, options, false)
}

/** Очередь оператора: все заявки, ждущие разбора. */
export async function requestQueue(
  user: platform.User,
  options: { status?: intake.RequestStatus | undefined; limit?: number | undefined; offset?: number | undefined } = {},
): Promise<RequestsPage> {
  const page = await intake.listRequests(user, options)
  return shape(page, options, true)
}

async function shape(
  page: intake.RequestPage,
  options: { limit?: number | undefined; offset?: number | undefined },
  withCompany: boolean,
): Promise<RequestsPage> {
  const categories = await catalog.listCategories({})
  const byId = new Map(categories.map((c) => [c.id, c.name]))

  const items = await Promise.all(
    page.items.map(async (request) => ({
      id: request.id,
      number: request.number,
      // Заголовок — первая строка того, что написал человек: список заявок
      // читают глазом, и «Заявка №1240» в каждой строке не помогает
      title: firstLine(request.rawText),
      categoryName: request.categoryId ? (byId.get(request.categoryId) ?? null) : null,
      urgency: URGENCY_WORDS[request.urgency] ?? request.urgency,
      status: STATUS_WORDS[request.status] ?? request.status,
      statusKind: statusKind(request.status),
      address: request.address,
      zoneName: request.zoneCode ? (catalog.findZone(request.zoneCode)?.name ?? null) : null,
      contact: contactOf(request),
      companyName: withCompany ? await companyName(request.clientOrgId) : null,
      desiredAt: request.desiredAt,
      createdAt: request.createdAt,
    })),
  )

  return {
    items,
    total: page.total,
    limit: options.limit ?? 50,
    offset: options.offset ?? 0,
  }
}

export type RequestCard = RequestRow & {
  rawText: string | null
  history: Array<{ what: string; when: Date }>
}

const EVENT_WORDS: Record<string, string> = {
  created: 'Заявка принята',
}

export async function requestCard(
  user: platform.User,
  requestId: string,
): Promise<RequestCard | null> {
  const request = await intake.getRequest(user, requestId).catch(() => null)
  if (!request) return null

  const page = await shape({ items: [request], total: 1 }, {}, true)
  const row = page.items[0]!
  const history = await intake.requestHistory(user, requestId)

  return {
    ...row,
    rawText: request.rawText,
    history: history.map((event) => ({
      what: EVENT_WORDS[event.type] ?? event.type,
      when: event.createdAt,
    })),
  }
}

/** Точки клиента для формы заявки: выбор из списка, а не ввод адреса руками. */
export async function siteOptions(
  user: platform.User,
): Promise<Array<{ id: string; label: string; hint: string }>> {
  const sites = await platform.listSites(user, user.orgId)
  return sites.map((site) => ({
    id: site.id,
    label: site.name,
    hint: `${site.address} · ${catalog.findZone(site.zoneCode)?.name ?? site.zoneCode}`,
  }))
}

export async function categoryOptions(): Promise<catalog.Category[]> {
  return catalog.listCategories({ activeOnly: true })
}

// ─── Мелочи показа ──────────────────────────────────────────────────────

function firstLine(text: string | null): string {
  if (!text) return 'Без описания'
  const line = text.split('\n')[0]?.trim() ?? ''
  return line.length > 80 ? `${line.slice(0, 80)}…` : line || 'Без описания'
}

function statusKind(status: string): 'wait' | 'done' | 'stop' {
  if (status === 'converted') return 'done'
  if (status === 'rejected') return 'stop'
  return 'wait'
}

function contactOf(request: intake.Request): string | null {
  const phone = request.contactPhone ? formatPhone(request.contactPhone) : null
  return [request.contactName, phone].filter(Boolean).join(', ') || null
}

async function companyName(orgId: string): Promise<string | null> {
  return platform
    .getOrg(orgId)
    .then((org) => org.name)
    .catch(() => null)
}

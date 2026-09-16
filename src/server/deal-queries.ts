import 'server-only'
import * as catalog from '@/modules/catalog'
import * as deal from '@/modules/deal'
import * as platform from '@/modules/platform'
import { formatKopecks } from '@/shared/money'

/**
 * Чтение сделок для экранов.
 *
 * Права проверяет модуль в каждом запросе (§6). Здесь — перевод статусов
 * в человеческие слова и в понятную человеку следующую шаг.
 */

export function isAvailable(): boolean {
  return true
}

/**
 * Статус словами — и РАЗНЫМИ для клиента и подрядчика.
 *
 * «Оплачено» для клиента значит «я заплатил», для подрядчика — «деньги
 * у площадки, можно работать». Один текст на двоих был бы понятен
 * в лучшем случае одному.
 */
const FOR_CLIENT: Record<deal.DealStatus, string> = {
  new: 'Оформляем',
  matching: 'Ищем подрядчиков',
  quoted: 'Выберите вариант',
  accepted: 'Ждём вашей оплаты',
  paid: 'Деньги у площадки',
  in_progress: 'Подрядчик работает',
  act_issued: 'Примите работу',
  act_signed: 'Работа принята',
  completed: 'Завершён',
  disputed: 'Разбираем спор',
  cancelled: 'Отменён',
}

const FOR_CONTRACTOR: Record<deal.DealStatus, string> = {
  new: 'Новый заказ',
  matching: 'Идёт подбор',
  quoted: 'Клиент выбирает',
  accepted: 'Ждём оплату клиента',
  paid: 'Деньги у площадки — можно работать',
  in_progress: 'В работе',
  act_issued: 'Ждём подписи клиента',
  act_signed: 'Клиент принял, готовим выплату',
  completed: 'Закрыт, выплата вам в реестре',
  disputed: 'Спор, разбирает оператор',
  cancelled: 'Отменён',
}

/** Что сейчас происходит с деньгами. Главное обещание площадки, словами. */
const MONEY: Partial<Record<deal.DealStatus, string>> = {
  accepted: 'Пока вы не заплатили, подрядчик не начинает',
  paid: 'Ваши деньги у площадки. Подрядчику они уйдут после того, как вы примете работу',
  in_progress: 'Ваши деньги у площадки и подрядчику ещё не ушли',
  act_issued: 'Деньги уйдут подрядчику, когда вы подпишете акт',
  act_signed: 'Работа принята, выплата подрядчику готовится',
  disputed: 'Деньги у площадки и никуда не уйдут, пока мы не разберёмся',
  completed: 'Деньги переданы подрядчику за вычетом комиссии',
}

export type DealRow = {
  id: string
  number: number
  title: string
  price: string | null
  status: string
  statusKind: 'wait' | 'work' | 'done' | 'stop'
  money: string | null
  address: string | null
  companyName: string | null
  contractorName: string | null
  createdAt: Date
  /** Что человек может сделать прямо сейчас. Пусто — ждёт другую сторону. */
  nextAction: { to: deal.DealStatus; label: string } | null
  canCancel: boolean
  canDispute: boolean
}

export type DealsPage = { items: DealRow[]; total: number }

/**
 * Следующий шаг клиента. Одно действие, а не список: если на экране два
 * главных действия, экран спроектирован неправильно (§7.1).
 */
const CLIENT_NEXT: Partial<Record<deal.DealStatus, { to: deal.DealStatus; label: string }>> = {
  new: { to: 'accepted', label: 'Подтвердить заказ' },
  accepted: { to: 'paid', label: 'Оплатить' },
  act_issued: { to: 'act_signed', label: 'Принять работу' },
}

const CONTRACTOR_NEXT: Partial<Record<deal.DealStatus, { to: deal.DealStatus; label: string }>> = {
  paid: { to: 'in_progress', label: 'Начать работу' },
  in_progress: { to: 'act_issued', label: 'Работа готова, выставить акт' },
}

export async function clientDeals(user: platform.User): Promise<DealsPage> {
  const page = await deal.listDeals(user, { clientOrgId: user.orgId })
  return { items: await Promise.all(page.items.map((d) => toRow(d, 'client'))), total: page.total }
}

export async function contractorDeals(
  user: platform.User,
  contractorId: string,
): Promise<DealsPage> {
  const page = await deal.listDeals(user, { contractorId })
  return {
    items: await Promise.all(page.items.map((d) => toRow(d, 'contractor'))),
    total: page.total,
  }
}

export type DealCard = DealRow & {
  history: Array<{ what: string; who: string | null; reason: string | null; when: Date }>
}

export async function dealCard(
  user: platform.User,
  dealId: string,
  as: 'client' | 'contractor',
): Promise<DealCard | null> {
  const found = await deal.getDeal(user, dealId).catch(() => null)
  if (!found) return null

  const row = await toRow(found, as)
  const history = await deal.dealHistory(user, dealId)

  return {
    ...row,
    history: history.map((event) => ({
      what: (as === 'client' ? FOR_CLIENT : FOR_CONTRACTOR)[event.toStatus],
      who: event.actorName,
      reason: event.reason,
      when: event.createdAt,
    })),
  }
}

/** Точки клиента для выбора при заказе: адрес руками не вводится. */
export async function siteChoices(
  user: platform.User,
): Promise<Array<{ id: string; label: string; hint: string }>> {
  const sites = await platform.listSites(user, user.orgId)
  return sites.map((site) => ({
    id: site.id,
    label: site.name,
    hint: `${site.address} · ${catalog.findZone(site.zoneCode)?.name ?? site.zoneCode}`,
  }))
}

// ─── Внутреннее ─────────────────────────────────────────────────────────

async function toRow(d: deal.Deal, as: 'client' | 'contractor'): Promise<DealRow> {
  const next = as === 'client' ? CLIENT_NEXT[d.status] : CONTRACTOR_NEXT[d.status]

  return {
    id: d.id,
    number: d.number,
    title: d.title ?? 'Заказ',
    // Копейки в рубли — только в слое отображения (§6)
    price: d.priceKopecks === null ? null : formatKopecks(d.priceKopecks),
    status: (as === 'client' ? FOR_CLIENT : FOR_CONTRACTOR)[d.status],
    statusKind: kindOf(d.status),
    money: MONEY[d.status] ?? null,
    address: d.address,
    companyName: as === 'contractor' ? await orgName(d.clientOrgId) : null,
    contractorName: as === 'client' ? await contractorName(d.contractorId) : null,
    createdAt: d.createdAt,
    nextAction: next ?? null,
    canCancel: deal.nextStatuses(d.status).includes('cancelled'),
    canDispute: as === 'client' && deal.nextStatuses(d.status).includes('disputed'),
  }
}

function kindOf(status: deal.DealStatus): DealRow['statusKind'] {
  if (status === 'completed' || status === 'act_signed') return 'done'
  if (status === 'cancelled' || status === 'disputed') return 'stop'
  if (status === 'in_progress' || status === 'paid') return 'work'
  return 'wait'
}

async function orgName(orgId: string): Promise<string | null> {
  return platform.getOrg(orgId).then((org) => org.name).catch(() => null)
}

async function contractorName(contractorId: string | null): Promise<string | null> {
  if (!contractorId) return null
  const contractor = await catalog.getContractor(contractorId).catch(() => null)
  if (!contractor) return null
  return orgName(contractor.orgId)
}

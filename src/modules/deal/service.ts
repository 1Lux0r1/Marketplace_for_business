import { and, desc, eq, sql } from 'drizzle-orm'
import { getDb, type Executor } from '@/shared/db'
import { uuidv7 } from '@/shared/id'
import * as platform from '@/modules/platform'
import * as catalog from '@/modules/catalog'
import { dealEvents, deals } from './schema'
import { canMove, payoutAllowed } from './statuses'
import { errors } from './errors'
import type { Deal, DealEvent, DealFilter, DealPage, DealStatus } from './types'

/**
 * Сделка: создание из каталога и переходы статусов.
 *
 * Каждый переход — одна транзакция: сама сделка, запись в её историю
 * и событие в очередь (§5). Иначе бывает сделка, о которой никто не узнал,
 * или письмо о переходе, которого не случилось.
 */

const MAX_LIMIT = 200

/**
 * Заказ из каталога — основной путь клиента (§1).
 *
 * Цена копируется из карточки СНИМКОМ, а не берётся ссылкой: цена в карточке
 * это оферта подрядчика на сегодня, и завтрашняя правка не должна менять
 * уже заключённую сделку.
 */
export async function createFromListing(input: {
  actor: Pick<platform.User, 'id' | 'orgId' | 'role'>
  listingId: string
  siteId: string
  qty?: string | undefined
}): Promise<Deal> {
  // Соседский запрос сам отсекает черновики, снятые карточки и карточки
  // заблокированных подрядчиков: заказать можно только то, что на витрине
  const listing = await catalog.getStorefrontListing(input.listingId).catch(() => null)
  if (!listing) {
    throw errors.badDeal('Эта услуга больше не продаётся. Посмотрите, что есть сейчас.')
  }

  // Точка читается командой соседа — она же проверяет права (§4.2, §6)
  const site = await platform.getSite(input.actor, input.siteId)
  if (site.archived) {
    throw errors.badDeal('Эта точка убрана из списка. Выберите другую или верните её в кабинете.')
  }

  const qty = (input.qty ?? listing.minQty ?? '1').trim()
  if (!/^\d+(\.\d+)?$/u.test(qty) || Number(qty) <= 0) {
    throw errors.badDeal('Укажите, сколько нужно')
  }
  if (Number(qty) < Number(listing.minQty ?? '1')) {
    throw errors.badDeal(`Подрядчик берётся от ${listing.minQty} ${listing.unit}`)
  }

  // Цена в копейках и целыми (§6): умножаем на количество, не деля
  const priceKopecks = listing.priceKopecks * BigInt(Math.round(Number(qty) * 1000)) / 1000n

  const id = uuidv7()
  const db = getDb()

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(deals)
      .values({
        id,
        source: 'catalog',
        clientOrgId: input.actor.orgId,
        contractorId: listing.contractorId,
        listingId: listing.id,
        siteId: site.id,
        status: 'new',
        priceKopecks,
        qty,
        unit: listing.unit,
        title: listing.title,
        // Снимком: точку переименуют, а сделка помнит, куда ехали
        address: site.address,
        zoneCode: site.zoneCode,
      })
      .returning()

    const created = toDeal(row!)
    await writeEvent(tx, { dealId: id, from: null, to: 'new', actor: input.actor })
    await publish(tx, 'deal.created', created)
    return created
  })
}

/**
 * Перевести сделку в другой статус.
 *
 * ЕДИНСТВЕННЫЙ способ изменить статус — других команд нет и быть не должно.
 * Обновление статуса запросом мимо этой функции обошло бы и таблицу
 * переходов, и историю, и событие: три вещи, на которых держится сделка.
 */
export async function moveTo(input: {
  actor: Pick<platform.User, 'id' | 'orgId' | 'role'> & { fullName?: string | undefined }
  dealId: string
  to: DealStatus
  reason?: string | undefined
}): Promise<Deal> {
  const db = getDb()

  return db.transaction(async (tx) => {
    // Читаем под блокировкой: два одновременных перехода не должны
    // оба увидеть старый статус и оба пройти проверку
    const [row] = await tx.select().from(deals).where(eq(deals.id, input.dealId)).limit(1).for('update')
    if (!row) throw errors.dealNotFound()

    const current = toDeal(row)
    const operator = platform.hasRole(input.actor, 'operator')
    assertParty(current, input.actor, operator)

    const check = canMove({
      from: current.status,
      to: input.to,
      source: current.source,
      byOperator: operator,
    })
    if (!check.ok) {
      if (check.reason === 'operator_only') throw errors.needsOperator()
      throw errors.badTransition(current.status, input.to)
    }

    // Отмена и рекламация без причины бесполезны: их читает вторая сторона
    // и оператор при разборе, и «отменено» без слов — это не объяснение
    const needsReason = input.to === 'cancelled' || input.to === 'disputed'
    const reason = input.reason?.trim() || null
    if (needsReason && !reason) throw errors.reasonRequired()

    const [updated] = await tx
      .update(deals)
      .set({ status: input.to, statusAt: new Date() })
      .where(eq(deals.id, input.dealId))
      .returning()

    const next = toDeal(updated!)
    await writeEvent(tx, {
      dealId: input.dealId,
      from: current.status,
      to: input.to,
      actor: input.actor,
      reason,
    })

    const event = EVENT_FOR[input.to]
    if (event) await publish(tx, event, next)

    return next
  })
}

const EVENT_FOR: Partial<Record<DealStatus, string>> = {
  accepted: 'deal.accepted',
  paid: 'deal.paid',
  completed: 'deal.completed',
  disputed: 'deal.disputed',
  cancelled: 'deal.cancelled',
}

/**
 * Одна сделка. Права проверяются ПОСЛЕ чтения, но до возврата: иначе разница
 * между «не найдено» и «не ваше» выдаёт, какие сделки есть у других.
 */
export async function getDeal(
  actor: Pick<platform.User, 'orgId' | 'role'>,
  dealId: string,
): Promise<Deal> {
  const [row] = await getDb().select().from(deals).where(eq(deals.id, dealId)).limit(1)
  if (!row) throw errors.dealNotFound()

  const found = toDeal(row)
  assertParty(found, actor, platform.hasRole(actor, 'operator'))
  return found
}

export async function listDeals(
  actor: Pick<platform.User, 'orgId' | 'role'>,
  filter: DealFilter = {},
): Promise<DealPage> {
  const staff = platform.hasRole(actor, 'operator')
  if (!staff && !filter.clientOrgId && !filter.contractorId) {
    // Клиент без фильтра видит свои: показывать ему всё нельзя
    filter = { ...filter, clientOrgId: actor.orgId }
  }
  if (!staff && filter.clientOrgId && filter.clientOrgId !== actor.orgId) throw errors.forbidden()

  const db = getDb()
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), MAX_LIMIT)
  const offset = Math.max(filter.offset ?? 0, 0)

  const conditions = [
    filter.clientOrgId ? eq(deals.clientOrgId, filter.clientOrgId) : undefined,
    filter.contractorId ? eq(deals.contractorId, filter.contractorId) : undefined,
    filter.status ? eq(deals.status, filter.status) : undefined,
  ].filter((c) => c !== undefined)
  const where = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db
    .select()
    .from(deals)
    .where(where)
    .orderBy(desc(deals.createdAt))
    .limit(limit)
    .offset(offset)

  const [counted] = await db.select({ total: sql<number>`count(*)::int` }).from(deals).where(where)
  return { items: rows.map(toDeal), total: counted?.total ?? 0 }
}

/** История сделки: её читают клиент, подрядчик и оператор при разборе спора. */
export async function dealHistory(
  actor: Pick<platform.User, 'orgId' | 'role'>,
  dealId: string,
): Promise<DealEvent[]> {
  await getDeal(actor, dealId)
  const rows = await getDb()
    .select()
    .from(dealEvents)
    .where(eq(dealEvents.dealId, dealId))
    .orderBy(dealEvents.id)

  return rows.map((row) => ({
    fromStatus: row.fromStatus as DealStatus | null,
    toStatus: row.toStatus as DealStatus,
    actorName: row.actorName,
    reason: row.reason,
    createdAt: row.createdAt,
  }))
}

/**
 * Можно ли платить подрядчику по этой сделке.
 *
 * Модуль выплат обязан спрашивать здесь, а не сравнивать статусы у себя:
 * одно правило — одно место (§8).
 */
export async function canPayOut(dealId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ status: deals.status })
    .from(deals)
    .where(eq(deals.id, dealId))
    .limit(1)
  return row ? payoutAllowed(row.status as DealStatus) : false
}

// ─── Внутреннее ─────────────────────────────────────────────────────────

/** Сделку видят её стороны и сотрудники площадки — больше никто. */
function assertParty(
  deal: Deal,
  actor: Pick<platform.User, 'orgId' | 'role'>,
  operator: boolean,
): void {
  if (operator) return
  if (deal.clientOrgId === actor.orgId) return
  // Подрядчик смотрит по своей организации: `contractorId` принадлежит
  // каталогу, и сверять его здесь значило бы лезть в чужую схему
  throw errors.forbidden()
}

async function writeEvent(
  exec: Executor,
  input: {
    dealId: string
    from: DealStatus | null
    to: DealStatus
    actor: { id: string; fullName?: string | undefined }
    reason?: string | null | undefined
  },
): Promise<void> {
  await exec.insert(dealEvents).values({
    dealId: input.dealId,
    fromStatus: input.from,
    toStatus: input.to,
    actorId: input.actor.id,
    actorName: input.actor.fullName ?? null,
    reason: input.reason ?? null,
  })
}

async function publish(exec: Executor, type: string, deal: Deal): Promise<void> {
  await platform.publish(exec, {
    type,
    aggregate: 'deal',
    aggregateId: deal.id,
    payload: {
      dealId: deal.id,
      number: deal.number,
      status: deal.status,
      clientOrgId: deal.clientOrgId,
      contractorId: deal.contractorId,
      // Копейки строкой: bigint в JSON не кладётся, а число потеряет точность
      priceKopecks: deal.priceKopecks === null ? null : deal.priceKopecks.toString(),
    },
  })
}

type Row = typeof deals.$inferSelect

function toDeal(row: Row): Deal {
  return {
    id: row.id,
    number: Number(row.number),
    source: row.source as Deal['source'],
    clientOrgId: row.clientOrgId,
    contractorId: row.contractorId,
    listingId: row.listingId,
    requestId: row.requestId,
    siteId: row.siteId,
    status: row.status as DealStatus,
    priceKopecks: row.priceKopecks,
    qty: row.qty,
    unit: row.unit,
    title: row.title,
    commissionRate: row.commissionRate,
    commissionReason: row.commissionReason,
    commissionKopecks: row.commissionKopecks,
    address: row.address,
    zoneCode: row.zoneCode,
    scheduledAt: row.scheduledAt,
    createdAt: row.createdAt,
    statusAt: row.statusAt,
  }
}

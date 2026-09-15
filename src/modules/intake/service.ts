import { and, desc, eq, sql } from 'drizzle-orm'
import { getDb } from '@/shared/db'
import { uuidv7 } from '@/shared/id'
import { normalizePhone } from '@/shared/phone'
import { isKnownZone } from '@/shared/zones'
import * as platform from '@/modules/platform'
import { requestEvents, requests } from './schema'
import { errors } from './errors'
import type { Request, RequestFilter, RequestPage, RequestStatus, Urgency } from './types'

/**
 * Приём заявки.
 *
 * Заявка — ещё не сделка: это описание задачи, по которому подрядчики дадут
 * цену и срок. Поэтому здесь нет ни цены, ни подрядчика, и появиться они
 * должны не здесь.
 */

const URGENCY: readonly Urgency[] = ['normal', 'urgent', 'planned']
const MAX_LIMIT = 200
const MAX_TEXT = 4000

/**
 * Создать заявку.
 *
 * Заявка, событие о ней и запись в журнал заявки — ОДНА ТРАНЗАКЦИЯ (§5).
 * Иначе бывает заявка, о которой никто не узнал, или письмо подрядчикам
 * о заявке, которой нет. Это проверяется тестом.
 *
 * Зона берётся из точки клиента и руками не вводится: код зоны с опечаткой
 * молча обнулил бы подбор — заявку просто не увидел бы ни один подрядчик,
 * и никто бы не понял почему.
 */
export async function createRequest(input: {
  actor: Pick<platform.User, 'id' | 'orgId' | 'role'>
  siteId: string
  rawText: string
  categoryId?: string | undefined
  urgency?: Urgency | undefined
  contactName?: string | undefined
  contactPhone?: string | undefined
  desiredAt?: Date | undefined
  source?: 'web' | 'telegram' | 'operator' | undefined
}): Promise<Request> {
  const rawText = input.rawText.trim()
  if (rawText.length < 10) {
    throw errors.badRequest('Опишите задачу хотя бы одним предложением — так подрядчики поймут, о чём речь')
  }
  if (rawText.length > MAX_TEXT) {
    throw errors.badRequest('Слишком длинное описание. Оставьте главное, остальное расскажете подрядчику.')
  }

  const urgency = input.urgency ?? 'normal'
  if (!URGENCY.includes(urgency)) throw errors.badRequest('Выберите срочность из списка')

  // Точка читается командой соседа, а не соединением таблиц (§4.2). Она же
  // проверяет права: чужая точка недоступна даже с верным идентификатором
  const site = await platform.getSite(input.actor, input.siteId)
  if (site.archived) {
    throw errors.badRequest('Эта точка убрана из списка. Выберите другую или верните её в кабинете.')
  }
  if (!isKnownZone(site.zoneCode)) {
    // Зона у точки битая: заявку принять можно, но подбор по ней не сработает,
    // и молчать об этом нельзя
    throw errors.badRequest('У этой точки не указан округ. Откройте её в кабинете и выберите округ.')
  }

  let contactPhone: string | null = null
  if (input.contactPhone && input.contactPhone.trim() !== '') {
    const normalized = normalizePhone(input.contactPhone)
    if (!normalized.ok) throw errors.badRequest(normalized.error)
    contactPhone = normalized.phone
  }

  const id = uuidv7()
  const db = getDb()

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(requests)
      .values({
        id,
        clientOrgId: input.actor.orgId,
        createdBy: input.actor.id,
        siteId: site.id,
        source: input.source ?? 'web',
        rawText,
        categoryId: input.categoryId ?? null,
        urgency,
        // Снимком: точку переименуют или уберут, а заявка обязана помнить,
        // куда ехали
        address: site.address,
        zoneCode: site.zoneCode,
        contactName: input.contactName?.trim() || site.contactName,
        contactPhone: contactPhone ?? site.contactPhone,
        desiredAt: input.desiredAt ?? null,
        status: 'new',
        // Заявку разбирает человек: ИИ появится позже, а цифру «насколько
        // модель лучше правил» собирать надо с первой заявки
        parseSource: 'operator',
        parseMeta: {},
      })
      .returning()

    const created = toRequest(row!)

    await tx.insert(requestEvents).values({
      requestId: id,
      type: 'created',
      payload: { source: created.source, urgency: created.urgency },
    })

    // Персональных данных в событии нет намеренно: очередь хранит полезную
    // нагрузку открытым текстом, а подписчикам ФИО и телефон не нужны
    await platform.publish(tx, {
      type: 'request.created',
      aggregate: 'request',
      aggregateId: id,
      payload: {
        requestId: id,
        number: created.number,
        clientOrgId: created.clientOrgId,
        categoryId: created.categoryId,
        zoneCode: created.zoneCode,
        urgency: created.urgency,
      },
    })

    return created
  })
}

/**
 * Одна заявка. Права проверяются ПОСЛЕ чтения, но до возврата: иначе пришлось
 * бы отвечать «не найдено» на чужую заявку и «нет прав» на несуществующую,
 * а разница между этими ответами — способ узнать, какие заявки есть у других.
 */
export async function getRequest(
  actor: Pick<platform.User, 'orgId' | 'role'>,
  requestId: string,
): Promise<Request> {
  const [row] = await getDb().select().from(requests).where(eq(requests.id, requestId)).limit(1)
  if (!row) throw errors.requestNotFound()

  // Сотрудники площадки видят чужие заявки по роду работы
  if (row.clientOrgId !== actor.orgId && !platform.hasRole(actor, 'operator')) {
    throw errors.forbidden()
  }
  return toRequest(row)
}

/**
 * Список заявок.
 *
 * Без `clientOrgId` в фильтре это очередь оператора — поэтому она и требует
 * роли оператора. Клиент своим списком тоже пользуется, но только своим.
 */
export async function listRequests(
  actor: Pick<platform.User, 'orgId' | 'role'>,
  filter: RequestFilter = {},
): Promise<RequestPage> {
  const staff = platform.hasRole(actor, 'operator')
  const orgId = filter.clientOrgId ?? (staff ? undefined : actor.orgId)

  if (orgId !== undefined && orgId !== actor.orgId && !staff) throw errors.forbidden()
  if (orgId === undefined && !staff) throw errors.forbidden()

  const db = getDb()
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), MAX_LIMIT)
  const offset = Math.max(filter.offset ?? 0, 0)

  const conditions = [
    orgId ? eq(requests.clientOrgId, orgId) : undefined,
    filter.status ? eq(requests.status, filter.status) : undefined,
  ].filter((c) => c !== undefined)
  const where = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db
    .select()
    .from(requests)
    .where(where)
    .orderBy(desc(requests.createdAt), desc(requests.number))
    .limit(limit)
    .offset(offset)

  const [counted] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(requests)
    .where(where)

  return { items: rows.map(toRequest), total: counted?.total ?? 0 }
}

/** Что происходило с заявкой: для карточки у оператора. */
export async function requestHistory(
  actor: Pick<platform.User, 'orgId' | 'role'>,
  requestId: string,
): Promise<Array<{ type: string; payload: Record<string, unknown>; createdAt: Date }>> {
  // Через getRequest: он же и проверяет права
  await getRequest(actor, requestId)
  const rows = await getDb()
    .select()
    .from(requestEvents)
    .where(eq(requestEvents.requestId, requestId))
    .orderBy(requestEvents.id)
  return rows.map((row) => ({
    type: row.type,
    payload: (row.payload as Record<string, unknown>) ?? {},
    createdAt: row.createdAt,
  }))
}

type Row = typeof requests.$inferSelect

function toRequest(row: Row): Request {
  return {
    id: row.id,
    number: Number(row.number),
    clientOrgId: row.clientOrgId,
    createdBy: row.createdBy,
    siteId: row.siteId,
    source: row.source as Request['source'],
    rawText: row.rawText,
    categoryId: row.categoryId,
    urgency: row.urgency as Urgency,
    address: row.address,
    zoneCode: row.zoneCode,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    desiredAt: row.desiredAt,
    status: row.status as RequestStatus,
    parseSource: row.parseSource as Request['parseSource'],
    parseMeta: (row.parseMeta as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt,
  }
}

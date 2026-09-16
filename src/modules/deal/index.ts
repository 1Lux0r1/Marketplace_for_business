import * as service from './service'
import * as statuses from './statuses'

/**
 * Публичный интерфейс модуля `deal`.
 *
 * ЕДИНСТВЕННОЕ, что видят соседи (§4.4).
 *
 * Статус меняется ТОЛЬКО через `moveTo`. Отдельной команды «поставить статус»
 * нет и не должно появиться: она обошла бы таблицу переходов, историю сделки
 * и событие в очередь — три вещи, на которых сделка и держится.
 *
 * `payoutAllowed` — единственный ответ на вопрос «можно ли платить
 * подрядчику». Модуль выплат обязан спрашивать здесь, а не сравнивать
 * статусы у себя: одно правило живёт в одном месте (§8).
 */

export type { Deal, DealEvent, DealFilter, DealPage, DealSource, DealStatus } from './types'
export type { DealEventType } from './events'
export { DEAL_STATUSES } from './schema'
export { DealError } from './errors'
export type { DealErrorCode } from './errors'

export const createFromListing = service.createFromListing
export const moveTo = service.moveTo
export const getDeal = service.getDeal
export const listDeals = service.listDeals
export const dealHistory = service.dealHistory
export const canPayOut = service.canPayOut

export const payoutAllowed = statuses.payoutAllowed
export const nextStatuses = statuses.nextStatuses
export const canMove = statuses.canMove

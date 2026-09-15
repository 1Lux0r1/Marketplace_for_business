import * as service from './service'

/**
 * Публичный интерфейс модуля `intake`.
 *
 * ЕДИНСТВЕННОЕ, что видят соседи (§4.4).
 *
 * Заявка — ещё не сделка: здесь нет ни цены, ни подрядчика, и появиться
 * они должны не здесь. Отбор подрядчиков — `matching`, сделка — `deal`.
 */

export type {
  Request,
  RequestFilter,
  RequestPage,
  RequestSource,
  RequestStatus,
  Urgency,
  ParseSource,
} from './types'
export type { IntakeEvent, RequestCreated } from './events'
export { IntakeError } from './errors'
export type { IntakeErrorCode } from './errors'

export const createRequest = service.createRequest
export const getRequest = service.getRequest
export const listRequests = service.listRequests
export const requestHistory = service.requestHistory

import * as service from './service'

/**
 * Публичный интерфейс модуля `admin`.
 *
 * ЕДИНСТВЕННОЕ, что видят соседи (§4.4).
 *
 * У модуля намеренно нет ни одного импорта из других модулей: в него пишут
 * почти все, и обратная зависимость превратила бы это в кольцо. Админка
 * меняет чужие данные не отсюда, а вызовом команды модуля-владельца
 * из слоя команд формы — как любой другой сосед (§4).
 *
 * Правки и удаления записи здесь нет и не будет: журнал, который можно
 * поправить, не журнал. Их нет не в интерфейсе, а в модуле — вызвать нечего.
 */

export type { Actor, Change, ChangeFilter, ChangePage } from './types'
export { AdminError } from './errors'
export type { AdminErrorCode } from './errors'

/** Запись изменения. Принимает транзакцию вызывающего — см. `service.ts`. */
export const logChange = service.logChange

export const listChanges = service.listChanges
export const getChange = service.getChange

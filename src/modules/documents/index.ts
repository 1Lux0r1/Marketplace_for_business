import * as service from './service'

/**
 * Публичный интерфейс модуля `documents`.
 *
 * ЕДИНСТВЕННОЕ, что видят соседи (§4.4).
 *
 * Команды правки выданного документа здесь нет и не будет: документ,
 * однажды выпущенный, не меняется. Ошиблись — `voidDocument` и новый,
 * с новым номером. Правка задним числом — это то, за что снимают лицензии.
 */

export type {
  DocumentDoc,
  DocumentKind,
  DocumentStatus,
  SigningPath,
  Party,
} from './types'
export type { LineItem } from './templates'
export { DOCUMENT_KINDS, SIGNING_PATHS } from './schema'
export { DocumentError } from './errors'
export type { DocumentErrorCode } from './errors'

export const issue = service.issue
export const markSigned = service.markSigned
export const voidDocument = service.voidDocument
export const getDocument = service.getDocument
export const listForDeal = service.listForDeal
export const listForClient = service.listForClient

/** Есть ли подписанный акт. На этом держится разрешение выплаты (§8). */
export const hasSignedAct = service.hasSignedAct

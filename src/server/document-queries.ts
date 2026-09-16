import 'server-only'
import * as documents from '@/modules/documents'
import type * as platform from '@/modules/platform'
import { formatKopecks } from '@/shared/money'

/**
 * Чтение документов для экрана «Документы и счета».
 *
 * Права: документ отдаётся только своей компании. Идентификатор приходит
 * из адреса, и подставить чужой нельзя — сверяем владельца (§6).
 */

export function isAvailable(): boolean {
  return true
}

const KINDS: Record<documents.DocumentKind, string> = {
  contract: 'Договор',
  invoice: 'Счёт',
  act: 'Акт',
}

const STATUSES: Record<documents.DocumentStatus, string> = {
  issued: 'Ждёт подписания',
  signed: 'Подписан',
  void: 'Аннулирован',
}

export type DocumentRow = {
  id: string
  number: string
  kind: string
  status: string
  statusKind: 'wait' | 'done' | 'stop'
  amount: string | null
  dealNumber: number | null
  issuedAt: Date
  signedAt: Date | null
}

export async function clientDocuments(user: platform.User): Promise<DocumentRow[]> {
  const list = await documents.listForClient(user.orgId)
  return list.map(toRow)
}

/**
 * Один документ вместе с его готовым видом.
 *
 * Возвращает `null` и на чужой документ, и на несуществующий: разные ответы
 * позволяли бы, подставляя номера, узнать, какие документы есть у других.
 */
export async function clientDocument(
  user: platform.User,
  documentId: string,
): Promise<(DocumentRow & { html: string }) | null> {
  const doc = await documents.getDocument(documentId).catch(() => null)
  if (!doc || doc.clientOrgId !== user.orgId) return null
  return { ...toRow(doc), html: doc.html }
}

function toRow(doc: documents.DocumentDoc): DocumentRow {
  const data = doc.data as { dealNumber?: number }
  return {
    id: doc.id,
    number: doc.number,
    kind: KINDS[doc.kind],
    status: STATUSES[doc.status],
    statusKind: doc.status === 'signed' ? 'done' : doc.status === 'void' ? 'stop' : 'wait',
    // Копейки в рубли — только в слое отображения (§6)
    amount: doc.amountKopecks === null ? null : formatKopecks(doc.amountKopecks),
    dealNumber: typeof data.dealNumber === 'number' ? data.dealNumber : null,
    issuedAt: doc.issuedAt,
    signedAt: doc.signedAt,
  }
}

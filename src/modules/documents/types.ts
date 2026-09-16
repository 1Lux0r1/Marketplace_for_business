import type { DOCUMENT_KINDS, DOCUMENT_STATUSES, SIGNING_PATHS } from './schema'

export type DocumentKind = (typeof DOCUMENT_KINDS)[number]
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]
export type SigningPath = (typeof SIGNING_PATHS)[number]

/** Сторона документа — снимком на момент выдачи, а не ссылкой. */
export type Party = {
  name: string
  inn: string | null
  kpp: string | null
  address: string | null
}

export type DocumentDoc = {
  id: string
  number: string
  kind: DocumentKind
  dealId: string
  clientOrgId: string
  contractorId: string | null
  status: DocumentStatus
  signingPath: SigningPath
  amountKopecks: bigint | null
  data: Record<string, unknown>
  html: string
  issuedAt: Date
  signedAt: Date | null
  signedBy: string | null
  signature: Record<string, unknown> | null
  voidedAt: Date | null
  voidReason: string | null
}

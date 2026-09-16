import type { DEAL_STATUSES } from './schema'

export type DealStatus = (typeof DEAL_STATUSES)[number]
export type DealSource = 'catalog' | 'request'

export type Deal = {
  id: string
  /** Номер, который называют вслух: «сделка №1240». */
  number: number
  source: DealSource
  clientOrgId: string
  contractorId: string | null
  listingId: string | null
  requestId: string | null
  siteId: string | null
  status: DealStatus
  /** Всегда копейки, всегда целое (§6). `null` — цены ещё нет (путь заявки). */
  priceKopecks: bigint | null
  qty: string | null
  unit: string | null
  title: string | null
  commissionRate: string | null
  commissionReason: string | null
  commissionKopecks: bigint | null
  address: string | null
  zoneCode: string | null
  scheduledAt: Date | null
  createdAt: Date
  statusAt: Date
}

export type DealEvent = {
  fromStatus: DealStatus | null
  toStatus: DealStatus
  actorName: string | null
  reason: string | null
  createdAt: Date
}

export type DealFilter = {
  clientOrgId?: string | undefined
  contractorId?: string | undefined
  status?: DealStatus | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export type DealPage = {
  items: Deal[]
  total: number
}

export type RequestSource = 'web' | 'telegram' | 'operator'
export type Urgency = 'normal' | 'urgent' | 'planned'
export type RequestStatus = 'new' | 'parsed' | 'converted' | 'rejected'
export type ParseSource = 'ai' | 'rules' | 'operator'

export type Request = {
  id: string
  /** Номер, который человек называет вслух: «заявка №1240». */
  number: number
  clientOrgId: string
  createdBy: string | null
  siteId: string | null
  source: RequestSource
  rawText: string | null
  categoryId: string | null
  urgency: Urgency
  address: string | null
  zoneCode: string | null
  contactName: string | null
  contactPhone: string | null
  desiredAt: Date | null
  status: RequestStatus
  parseSource: ParseSource | null
  parseMeta: Record<string, unknown> | null
  createdAt: Date
}

export type RequestFilter = {
  clientOrgId?: string | undefined
  status?: RequestStatus | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export type RequestPage = {
  items: Request[]
  total: number
}

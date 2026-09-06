export type CategoryKind = 'service' | 'goods'
export type ContractorStatus = 'draft' | 'active' | 'paused' | 'blocked'
export type ListingStatus = 'draft' | 'pending' | 'published' | 'rejected' | 'archived'
export type ZoneKind = 'district' | 'city'

export type Category = {
  id: string
  code: string
  name: string
  kind: CategoryKind
  isActive: boolean
  sortOrder: number
}

export type Contractor = {
  id: string
  orgId: string
  status: ContractorStatus
  manualRating: number | null
  notes: string | null
  createdAt: Date
}

export type Zone = {
  code: string
  name: string
  kind: ZoneKind
}

export type Listing = {
  id: string
  contractorId: string
  categoryId: string
  title: string
  description: string | null
  unit: string
  priceKopecks: bigint
  minQty: string
  leadTimeHours: number | null
  status: ListingStatus
  publishedAt: Date | null
}

/** Подрядчик вместе с тем, что понадобилось на экране: категории и зоны. */
export type ContractorCard = Contractor & {
  categories: Category[]
  zones: Zone[]
}

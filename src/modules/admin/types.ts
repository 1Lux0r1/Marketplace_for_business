/** Кто совершил действие. Снимок на момент действия, а не ссылка. */
export type Actor = {
  id: string
  fullName: string
  role: string
}

export type Change = {
  id: string
  actorId: string
  actorName: string
  actorRole: string
  action: string
  entity: string
  entityId: string
  entityLabel: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  reason: string | null
  createdAt: Date
}

export type ChangeFilter = {
  entity?: string | undefined
  entityId?: string | undefined
  actorId?: string | undefined
  action?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export type ChangePage = {
  items: Change[]
  total: number
}

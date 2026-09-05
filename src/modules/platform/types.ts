/** Типы, которые модуль показывает соседям. Всё остальное внутреннее. */

export type Role = 'owner' | 'staff' | 'operator' | 'admin'

/** Форма собственности. Не путать с ролью: она не говорит, заказывает человек или выполняет. */
export type LegalForm = 'individual' | 'sole_trader' | 'company'

export type Org = {
  id: string
  legalForm: LegalForm
  name: string
  inn: string | null
  /** Заказывает и выполняет — не взаимоисключающие. */
  isClient: boolean
  isContractor: boolean
  isPlatform: boolean
  isActive: boolean
  innVerifiedAt: Date | null
}

export type User = {
  id: string
  orgId: string
  email: string
  emailVerified: boolean
  phone: string
  phoneVerified: boolean
  fullName: string
  /** Должность, а не права. */
  position: string | null
  role: Role
  isActive: boolean
}

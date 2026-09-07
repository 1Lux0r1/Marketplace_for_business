/** Типы, которые модуль показывает соседям. Всё остальное внутреннее. */

export type Role = 'owner' | 'staff' | 'operator' | 'admin'

/** Форма собственности. Не путать с ролью: она не говорит, заказывает человек или выполняет. */
export type LegalForm = 'individual' | 'sole_trader' | 'company'

export type Org = {
  id: string
  legalForm: LegalForm
  name: string
  inn: string | null
  /** КПП есть только у юрлиц: у ИП и самозанятых его не бывает. */
  kpp: string | null
  legalAddress: string | null
  /** Заказывает и выполняет — не взаимоисключающие. */
  isClient: boolean
  isContractor: boolean
  isPlatform: boolean
  isActive: boolean
  innVerifiedAt: Date | null
  /** Ответ справочника целиком: на основании чего компанию пустили. */
  innVerification: Record<string, unknown> | null
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

/**
 * Точка клиента: адрес, куда приезжает подрядчик.
 *
 * `archived` вместо удаления: на точку ссылаются заявки и сделки, и удаление
 * превратило бы историю заказов в ссылки в никуда.
 */
export type Site = {
  id: string
  orgId: string
  name: string
  address: string
  zoneCode: string
  contactName: string | null
  contactPhone: string | null
  note: string | null
  archived: boolean
  createdAt: Date
}

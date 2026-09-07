import 'server-only'
import * as catalog from '@/modules/catalog'
import * as platform from '@/modules/platform'
import { formatPhone } from '@/shared/phone'
import { currentUser } from '@/server/session'

/**
 * Чтение для кабинета клиента.
 *
 * Права проверяет модуль в каждой команде и в каждом запросе (§6). Здесь
 * только «кто пришёл»: экран мог отрисоваться когда угодно, а запрос
 * выполняется сейчас и по чужой воле тоже.
 */

/**
 * Есть ли за экраном сервер и база. В демо на GitHub Pages их нет, и там эта
 * функция отвечает «нет»: экран показывает объяснение и не пытается читать
 * из адреса то, чего в наборе файлов не бывает.
 */
export function isAvailable(): boolean {
  return true
}

export type CabinetAccess =
  | { allowed: true; user: platform.User }
  | { allowed: false; reason: 'anonymous' }

export async function requireUser(): Promise<CabinetAccess> {
  const user = await currentUser()
  return user ? { allowed: true, user } : { allowed: false, reason: 'anonymous' }
}

export type CompanyCard = {
  id: string
  name: string
  legalForm: platform.LegalForm
  inn: string | null
  kpp: string | null
  legalAddress: string | null
  innVerified: boolean
  isContractor: boolean
}

export type SiteRow = {
  id: string
  name: string
  address: string
  zoneCode: string
  zoneName: string
  contactName: string | null
  contactPhone: string | null
  note: string | null
  archived: boolean
}

export type PersonRow = {
  id: string
  fullName: string
  email: string
  phone: string
  position: string | null
  role: platform.Role
  isYou: boolean
  waitingForFirstLogin: boolean
}

export async function companyCard(user: platform.User): Promise<CompanyCard> {
  const org = await platform.getOrg(user.orgId)
  return {
    id: org.id,
    name: org.name,
    legalForm: org.legalForm,
    inn: org.inn,
    kpp: org.kpp,
    legalAddress: org.legalAddress,
    innVerified: org.innVerifiedAt !== null,
    isContractor: org.isContractor,
  }
}

export async function siteRows(
  user: platform.User,
  options?: { includeArchived?: boolean },
): Promise<SiteRow[]> {
  const sites = await platform.listSites(user, user.orgId, options)
  return sites.map((site) => ({
    id: site.id,
    name: site.name,
    address: site.address,
    zoneCode: site.zoneCode,
    // Код зоны человеку не показываем: «msk-cao» ему ничего не говорит
    zoneName: catalog.findZone(site.zoneCode)?.name ?? site.zoneCode,
    contactName: site.contactName,
    // В базе телефон хранится машинным видом, человеку он показывается
    // человеческим: +79161112233 глазом не читается
    contactPhone: site.contactPhone === null ? null : formatPhone(site.contactPhone),
    note: site.note,
    archived: site.archived,
  }))
}

export async function personRows(user: platform.User): Promise<PersonRow[]> {
  const people = await platform.listOrgUsers(user, user.orgId)
  return Promise.all(
    people.map(async (person) => ({
      id: person.id,
      fullName: person.fullName,
      email: person.email,
      phone: formatPhone(person.phone),
      position: person.position,
      role: person.role,
      isYou: person.id === user.id,
      // Приглашённый, который ещё не заходил: пароля у него нет, и это
      // единственное, что отличает «приглашение висит» от «человек работает»
      waitingForFirstLogin: !(await platform.hasPassword(person.id)),
    })),
  )
}

export function zoneOptions(): catalog.Zone[] {
  return catalog.listZones()
}

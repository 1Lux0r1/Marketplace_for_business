/**
 * Замена чтения кабинета для демо на GitHub Pages.
 *
 * В демо нет ни сервера, ни базы, поэтому кабинет отрисовывается в состоянии
 * «нужно войти». Подменяется на сборке (см. `next.config.ts`).
 */
import type * as catalog from '@/modules/catalog'
import { listZones } from '@/shared/zones'
import type {
  CabinetAccess,
  CompanyCard,
  PersonRow,
  SiteRow,
} from './company-queries'

export type { CabinetAccess, CompanyCard, PersonRow, SiteRow }

export function isAvailable(): boolean {
  return false
}

export function requireUser(): Promise<CabinetAccess> {
  return Promise.resolve({ allowed: false, reason: 'anonymous' })
}

export function companyCard(): Promise<CompanyCard | null> {
  return Promise.resolve(null)
}

export function siteRows(): Promise<SiteRow[]> {
  return Promise.resolve([])
}

export function personRows(): Promise<PersonRow[]> {
  return Promise.resolve([])
}

/** Список зон — статический, базы не требует: он и в демо настоящий. */
export function zoneOptions(): catalog.Zone[] {
  return listZones()
}

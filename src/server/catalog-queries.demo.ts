/**
 * Замена чтения каталога для демо на GitHub Pages.
 *
 * В демо нет ни сервера, ни базы, поэтому экраны оператора отрисовываются
 * в пустом состоянии. Подменяется на сборке (см. `next.config.ts`).
 */
import type * as catalog from '@/modules/catalog'
import type { ContractorDetails, ContractorRow, OperatorAccess } from './catalog-queries'

export type { ContractorRow, ContractorDetails, OperatorAccess }

export function requireOperator(): Promise<OperatorAccess> {
  return Promise.resolve({ allowed: false, reason: 'anonymous' })
}

export function contractorRows(): Promise<ContractorRow[]> {
  return Promise.resolve([])
}

export function contractorDetails(): Promise<ContractorDetails | null> {
  return Promise.resolve(null)
}

export function categoryOptions(): Promise<catalog.Category[]> {
  return Promise.resolve([])
}

export function zoneOptions(): catalog.Zone[] {
  return []
}

/**
 * Замена чтения сделок для демо на GitHub Pages: сервера и базы там нет.
 * Подменяется на сборке (см. `next.config.ts`).
 */
import type { DealCard, DealRow, DealsPage } from './deal-queries'

export type { DealCard, DealRow, DealsPage }

export function isAvailable(): boolean {
  return false
}

export function clientDeals(): Promise<DealsPage> {
  return Promise.resolve({ items: [], total: 0 })
}

export function contractorDeals(): Promise<DealsPage> {
  return Promise.resolve({ items: [], total: 0 })
}

export function dealCard(): Promise<DealCard | null> {
  return Promise.resolve(null)
}

export function siteChoices(): Promise<Array<{ id: string; label: string; hint: string }>> {
  return Promise.resolve([])
}

/**
 * Замена чтения заявок для демо на GitHub Pages: сервера и базы там нет.
 * Подменяется на сборке (см. `next.config.ts`).
 */
import type * as catalog from '@/modules/catalog'
import type { Access, RequestCard, RequestRow, RequestsPage } from './request-queries'

export { requireOperator, requireUser } from '@/server/session'
export type { Access, RequestCard, RequestRow, RequestsPage }

const empty: RequestsPage = { items: [], total: 0, limit: 50, offset: 0 }

export function isAvailable(): boolean {
  return false
}

export function myRequests(): Promise<RequestsPage> {
  return Promise.resolve(empty)
}

export function requestQueue(): Promise<RequestsPage> {
  return Promise.resolve(empty)
}

export function requestCard(): Promise<RequestCard | null> {
  return Promise.resolve(null)
}

export function siteOptions(): Promise<Array<{ id: string; label: string; hint: string }>> {
  return Promise.resolve([])
}

export function categoryOptions(): Promise<catalog.Category[]> {
  return Promise.resolve([])
}

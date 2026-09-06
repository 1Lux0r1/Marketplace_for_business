/**
 * Замена чтения витрины для демо на GitHub Pages: базы там нет,
 * витрина показывает пустое состояние. Подменяется на сборке.
 */
import * as catalog from '@/modules/catalog'
import type { StorefrontCard, StorefrontPage } from './storefront-queries'

export type { StorefrontCard, StorefrontPage }

export function isAvailable(): boolean {
  return false
}

export function storefront(): Promise<StorefrontPage> {
  return Promise.resolve({ items: [], total: 0, categories: [], zones: catalog.listZones() })
}

export function storefrontCard(): Promise<StorefrontCard | null> {
  return Promise.resolve(null)
}

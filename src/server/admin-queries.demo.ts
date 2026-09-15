/**
 * Замена чтения журнала для демо на GitHub Pages: сервера и базы там нет.
 * Подменяется на сборке (см. `next.config.ts`).
 */
import type { AdminAccess, ChangeRow, ChangesPage } from './admin-queries'

export type { AdminAccess, ChangeRow, ChangesPage }

export function isAvailable(): boolean {
  return false
}

export function requireAdmin(): Promise<AdminAccess> {
  return Promise.resolve({ allowed: false, reason: 'anonymous' })
}

export function changesPage(): Promise<ChangesPage> {
  return Promise.resolve({ items: [], total: 0, limit: 50, offset: 0 })
}

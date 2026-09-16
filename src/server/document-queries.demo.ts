/**
 * Замена чтения документов для демо на GitHub Pages: сервера и базы там нет.
 * Подменяется на сборке (см. `next.config.ts`).
 */
import type { DocumentRow } from './document-queries'

export type { DocumentRow }

export function isAvailable(): boolean {
  return false
}

export function clientDocuments(): Promise<DocumentRow[]> {
  return Promise.resolve([])
}

export function clientDocument(): Promise<(DocumentRow & { html: string }) | null> {
  return Promise.resolve(null)
}

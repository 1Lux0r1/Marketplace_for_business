/**
 * Замена команд сделки для демо на GitHub Pages: сервера там нет.
 * Подменяется на сборке (см. `next.config.ts`).
 */
import type { FormResult } from './deal-actions'

export type { FormResult }

const noServer: FormResult = {
  ok: false,
  error: 'Это демо без сервера: посмотреть можно, заказать — нет.',
}

export function orderFromCatalogAction(): Promise<FormResult> {
  return Promise.resolve(noServer)
}

export function moveDealAction(): Promise<FormResult> {
  return Promise.resolve(noServer)
}

/**
 * Замена команд заявки для демо на GitHub Pages: сервера там нет.
 * Подменяется на сборке (см. `next.config.ts`).
 */
import type { FormResult } from './request-actions'

export type { FormResult }

export function createRequestAction(): Promise<FormResult> {
  return Promise.resolve({
    ok: false,
    error: 'Это демо без сервера: форму можно посмотреть, отправить — нет.',
  })
}

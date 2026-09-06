/**
 * Замена команд каталога для демо на GitHub Pages: сервера там нет.
 * Подменяется на сборке (см. `next.config.ts`).
 */
import type { FormResult } from './catalog-actions'

const noServer: FormResult = {
  ok: false,
  error: 'Это демо без сервера: форму можно посмотреть, сохранить — нет.',
}

export type { FormResult }

export function createContractorAction(): Promise<FormResult> {
  return Promise.resolve(noServer)
}

export function updateContractorAction(): Promise<FormResult> {
  return Promise.resolve(noServer)
}

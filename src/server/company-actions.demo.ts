/**
 * Замена команд кабинета для демо на GitHub Pages: сервера там нет.
 * Подменяется на сборке (см. `next.config.ts`).
 */
import type { FormResult } from './company-actions'

const noServer: FormResult = {
  ok: false,
  error: 'Это демо без сервера: форму можно посмотреть, сохранить — нет.',
}

export type { FormResult }

export function addSiteAction(): Promise<FormResult> {
  return Promise.resolve(noServer)
}

export function updateSiteAction(): Promise<FormResult> {
  return Promise.resolve(noServer)
}

export function archiveSiteAction(): Promise<FormResult> {
  return Promise.resolve(noServer)
}

export function updateCompanyAction(): Promise<FormResult> {
  return Promise.resolve(noServer)
}

export function inviteAction(): Promise<FormResult> {
  return Promise.resolve(noServer)
}

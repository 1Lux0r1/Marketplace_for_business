/**
 * Замена сессии для демо на GitHub Pages.
 *
 * В демо нет ни сервера, ни базы, а значит и войти некому: шапка всегда
 * показывает кнопки «Войти» и «Регистрация». Подменяется на сборке
 * (см. `next.config.ts`).
 */
import type * as platform from '@/modules/platform'

export function currentUser(): Promise<platform.User | null> {
  return Promise.resolve(null)
}

export function currentOrgName(): Promise<string | null> {
  return Promise.resolve(null)
}

export function startSession(): Promise<void> {
  return Promise.resolve()
}

export function endSession(): Promise<void> {
  return Promise.resolve()
}

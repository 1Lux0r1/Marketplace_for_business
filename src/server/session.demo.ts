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

export function currentOrg(): Promise<platform.Org | null> {
  return Promise.resolve(null)
}

export function startSession(): Promise<void> {
  return Promise.resolve()
}

export function endSession(): Promise<void> {
  return Promise.resolve()
}

/**
 * В демо нет ни базы, ни сессий: «разрешено» здесь было бы дырой в наборе
 * файлов, который лежит в открытом доступе.
 */
export type Access<Role extends string = 'anonymous' | 'forbidden'> =
  | { allowed: true; user: platform.User }
  | { allowed: false; reason: Role }

export function requireUser(): Promise<Access<'anonymous'>> {
  return Promise.resolve({ allowed: false, reason: 'anonymous' })
}

export function requireOperator(): Promise<Access> {
  return Promise.resolve({ allowed: false, reason: 'anonymous' })
}

export function requireAdmin(): Promise<Access> {
  return Promise.resolve({ allowed: false, reason: 'anonymous' })
}

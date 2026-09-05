/**
 * Замена команд входа для демо на GitHub Pages.
 *
 * Демо — это набор обычных файлов без сервера и без базы (см. `next.config.ts`),
 * поэтому настоящие команды туда не собираются: формы можно открыть и
 * посмотреть, но зарегистрироваться нельзя. Говорим об этом прямо, а не делаем
 * вид, что отправляем.
 *
 * Подменяется на сборке: `next.config.ts` в режиме DEMO_EXPORT подставляет
 * этот файл вместо `actions.ts`. Формы про это не знают.
 */
import type { FormResult } from './auth-actions'

const noServer: FormResult = {
  ok: false,
  error: 'Это демо без сервера: форму можно посмотреть, зарегистрироваться — нет.',
}

export type { FormResult }

export function registerAction(): Promise<FormResult> {
  return Promise.resolve(noServer)
}

export function verifyEmailAction(): Promise<FormResult> {
  return Promise.resolve(noServer)
}

export function loginAction(): Promise<FormResult> {
  return Promise.resolve(noServer)
}

export function logoutAction(): Promise<void> {
  return Promise.resolve()
}

import 'server-only'
import { cookies } from 'next/headers'
import { config } from '@/shared/config'
import * as platform from '@/modules/platform'

/**
 * Сессия в куке. Кука недоступна скриптам на странице (`httpOnly`) и не уходит
 * на чужие сайты (`sameSite`).
 *
 * Права всё равно проверяются на сервере в каждой команде (§6): кука говорит,
 * кто пришёл, а не что ему можно.
 */
const COOKIE = 'session'

/**
 * Куку с признаком `secure` браузер отдаёт только по `https`. Смотрим на адрес,
 * по которому открывают приложение, а не на режим сборки: собранное приложение
 * на своей машине открывают по `http`, и по режиму сборки вход там молча
 * ломался бы — браузер просто не сохранял бы куку.
 *
 * Исключение делает сам браузер: на `localhost` такая кука работает и по `http`.
 * Поэтому ломалось бы не сразу, а только на своём домене вроде
 * `marketplace.local` — то есть в самом неудобном месте.
 */
function secureCookie(): boolean {
  return config().APP_URL.startsWith('https://')
}

export async function currentUser(): Promise<platform.User | null> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  return platform.getSession(token)
}

export async function startSession(token: string, remember: boolean): Promise<void> {
  const store = await cookies()
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookie(),
    path: '/',
    // Без галочки «запомнить» кука живёт до закрытия браузера: на чужом
    // компьютере это разница между «вышел» и «оставил доступ»
    ...(remember ? { maxAge: 30 * 24 * 60 * 60 } : {}),
  })
}

export async function endSession(): Promise<void> {
  const store = await cookies()
  const token = store.get(COOKIE)?.value
  if (token) await platform.logout(token)
  store.delete(COOKIE)
}

/** Название компании для шапки. Отдельным запросом: в сессии его нет. */
export async function currentOrgName(user: platform.User): Promise<string | null> {
  try {
    const org = await platform.getOrg(user.orgId)
    return org.name
  } catch {
    // Шапка не должна падать из-за компании: имя человека важнее
    return null
  }
}

import 'server-only'
import { cookies } from 'next/headers'
import * as platform from '@/modules/platform'

/**
 * Сессия в куке. Кука недоступна скриптам на странице (`httpOnly`), не уходит
 * на чужие сайты (`sameSite`) и по-настоящему шифруется на боевом сервере
 * (`secure`): в разработке `https` нет, и с этим флагом вход бы не работал.
 *
 * Права всё равно проверяются на сервере в каждой команде (§6): кука говорит,
 * кто пришёл, а не что ему можно.
 */
const COOKIE = 'session'

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
    secure: process.env.NODE_ENV === 'production',
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

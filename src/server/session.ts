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

/**
 * Компания вошедшего. Нужна не только для названия в шапке: из её ролей
 * («заказывает», «выполняет», «сотрудник площадки») собирается меню разделов —
 * см. `src/app/sections.ts`.
 */
export async function currentOrg(user: platform.User): Promise<platform.Org | null> {
  try {
    return await platform.getOrg(user.orgId)
  } catch {
    // Шапка не должна падать из-за компании: имя человека важнее
    return null
  }
}

// ─── Кто пришёл и что ему можно ─────────────────────────────────────────

/**
 * Проверки прав живут ЗДЕСЬ, в одном месте, и это не вкусовщина.
 *
 * Когда одна и та же проверка написана в трёх файлах под тремя именами,
 * однажды её поправят в двух. Поэтому у каждой роли ровно одна функция,
 * и экраны зовут её, а не пишут свою.
 *
 * Права проверяются в каждом запросе (§6), а не в меню: меню решает,
 * что показать, а не что можно, и адрес можно набрать руками.
 */
export type Access<Role extends string = 'anonymous' | 'forbidden'> =
  | { allowed: true; user: platform.User }
  | { allowed: false; reason: Role }

/** Просто вошедший человек: дальше за него решает модуль, чьи это данные. */
export async function requireUser(): Promise<Access<'anonymous'>> {
  const user = await currentUser()
  return user ? { allowed: true, user } : { allowed: false, reason: 'anonymous' }
}

/** Сотрудник площадки: оператор и выше. */
export async function requireOperator(): Promise<Access> {
  const user = await currentUser()
  if (!user) return { allowed: false, reason: 'anonymous' }
  if (!platform.hasRole(user, 'operator')) return { allowed: false, reason: 'forbidden' }
  return { allowed: true, user }
}

/**
 * Владелец площадки. РОВНО `admin`, а не «оператор и выше»: у ролей есть
 * старшинство, и проверка через него пустила бы сюда оператора, которому
 * в админке делать нечего.
 */
export async function requireAdmin(): Promise<Access> {
  const user = await currentUser()
  if (!user) return { allowed: false, reason: 'anonymous' }
  if (user.role !== 'admin') return { allowed: false, reason: 'forbidden' }
  return { allowed: true, user }
}

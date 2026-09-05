import { and, desc, eq, gt, sql } from 'drizzle-orm'
import { getDb, type Executor } from '@/shared/db'
import { uuidv7 } from '@/shared/id'
import { hashSecret, verifySecret, checkPasswordStrength, SCRYPT_PARAMS } from '@/shared/password'
import {
  createConfirmationCode,
  createLinkToken,
  hashLinkToken,
  normalizeCode,
} from '@/shared/token'
import { credentials, loginAttempts, loginTokens, sessions, users } from './schema'
import { errors } from './errors'
import { normalizeEmail } from './service'
import type { User } from './types'

/** Пароли, одноразовые ссылки и коды, сессии, ограничение частоты. */

export type TokenPurpose = 'login' | 'verify_email' | 'set_password' | 'reset_password'
export type AttemptMethod = 'password' | 'email_link' | 'code'

const CODE_TTL_MINUTES = 15
const LINK_TTL_MINUTES = 15
const MAX_CODE_ATTEMPTS = 5

const EMAILS_PER_ADDRESS = 3
const EMAILS_WINDOW_MINUTES = 15
const EMAILS_PER_IP = 10
const EMAILS_IP_WINDOW_MINUTES = 60

const PASSWORD_FAILURES_BEFORE_PAUSE = 5
const PASSWORD_FAILURE_WINDOW_MINUTES = 60

const SESSION_DAYS_REMEMBERED = 30
const SESSION_HOURS_PLAIN = 12
/** Продлеваем не чаще раза в сутки: иначе каждый клик — запись в базу. */
const SESSION_RENEW_AFTER_HOURS = 24

// ─── Ограничение частоты ────────────────────────────────────────────────

export async function recordAttempt(input: {
  email: string
  ip?: string | undefined
  method: AttemptMethod
  succeeded: boolean
}): Promise<void> {
  const db = getDb()
  await db.insert(loginAttempts).values({
    email: normalizeEmail(input.email),
    ip: input.ip ?? null,
    method: input.method,
    succeeded: input.succeeded,
  })
}

async function countAttempts(where: {
  email?: string | undefined
  ip?: string | undefined
  method?: AttemptMethod | undefined
  succeeded?: boolean | undefined
  sinceMinutes: number
}): Promise<number> {
  const db = getDb()
  const since = new Date(Date.now() - where.sinceMinutes * 60_000)
  const conditions = [gt(loginAttempts.at, since)]
  if (where.email) conditions.push(sql`lower(${loginAttempts.email}) = ${normalizeEmail(where.email)}`)
  if (where.ip) conditions.push(eq(loginAttempts.ip, where.ip))
  if (where.method) conditions.push(eq(loginAttempts.method, where.method))
  if (where.succeeded !== undefined) conditions.push(eq(loginAttempts.succeeded, where.succeeded))

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(and(...conditions))
  return row?.count ?? 0
}

/**
 * Без этого форма входа — бесплатная рассылка с нашего домена и способ
 * проверить, кто зарегистрирован на площадке.
 */
export async function assertCanSendEmail(email: string, ip?: string): Promise<void> {
  const perAddress = await countAttempts({
    email,
    method: 'email_link',
    sinceMinutes: EMAILS_WINDOW_MINUTES,
  })
  if (perAddress >= EMAILS_PER_ADDRESS) throw errors.tooManyAttempts(EMAILS_WINDOW_MINUTES)

  if (ip) {
    const perIp = await countAttempts({
      ip,
      method: 'email_link',
      sinceMinutes: EMAILS_IP_WINDOW_MINUTES,
    })
    if (perIp >= EMAILS_PER_IP) throw errors.tooManyAttempts(EMAILS_IP_WINDOW_MINUTES)
  }
}

/**
 * Пауза после неверных паролей, нарастающая: пять неудач — минута,
 * дальше вдвое за каждую, но не больше часа. Подбор становится бессмысленным,
 * а человек, который просто забыл пароль, ждёт минуту и заходит по ссылке.
 */
export async function assertCanTryPassword(email: string): Promise<void> {
  const failures = await countAttempts({
    email,
    method: 'password',
    succeeded: false,
    sinceMinutes: PASSWORD_FAILURE_WINDOW_MINUTES,
  })
  if (failures < PASSWORD_FAILURES_BEFORE_PAUSE) return

  const over = failures - PASSWORD_FAILURES_BEFORE_PAUSE
  const pauseMinutes = Math.min(2 ** over, 60)

  const db = getDb()
  const [last] = await db
    .select({ at: loginAttempts.at })
    .from(loginAttempts)
    .where(
      and(
        sql`lower(${loginAttempts.email}) = ${normalizeEmail(email)}`,
        eq(loginAttempts.method, 'password'),
        eq(loginAttempts.succeeded, false),
      ),
    )
    .orderBy(desc(loginAttempts.at))
    .limit(1)

  if (!last) return
  const waitedMs = Date.now() - last.at.getTime()
  if (waitedMs < pauseMinutes * 60_000) {
    throw errors.tooManyAttempts(Math.max(1, Math.ceil((pauseMinutes * 60_000 - waitedMs) / 60_000)))
  }
}

// ─── Пароль ─────────────────────────────────────────────────────────────

/** Проверка пароля — до записи в базу, чтобы не заводить лишнего. */
export function assertPasswordStrength(password: string): void {
  const weak = checkPasswordStrength(password)
  if (weak) throw errors.weakPassword(weak)
}

export async function setPassword(
  userId: string,
  password: string,
  exec?: Executor,
): Promise<void> {
  assertPasswordStrength(password)

  const db = exec ?? getDb()
  const secretHash = await hashSecret(password)

  await db.transaction(async (tx) => {
    // Старый пароль отключается, а не удаляется: по журналу видно,
    // что смена была
    await tx
      .update(credentials)
      .set({ isActive: false })
      .where(and(eq(credentials.userId, userId), eq(credentials.kind, 'password')))
    await tx.insert(credentials).values({
      id: uuidv7(),
      userId,
      kind: 'password',
      secretHash,
      params: { alg: 'scrypt', ...SCRYPT_PARAMS },
    })
  })
}

export async function verifyPassword(userId: string, password: string): Promise<boolean> {
  const db = getDb()
  const [row] = await db
    .select()
    .from(credentials)
    .where(
      and(
        eq(credentials.userId, userId),
        eq(credentials.kind, 'password'),
        eq(credentials.isActive, true),
      ),
    )
    .limit(1)

  if (!row?.secretHash) return false
  const ok = await verifySecret(password, row.secretHash)
  if (ok) await db.update(credentials).set({ lastUsedAt: new Date() }).where(eq(credentials.id, row.id))
  return ok
}

export async function hasPassword(userId: string): Promise<boolean> {
  const db = getDb()
  const [row] = await db
    .select({ id: credentials.id })
    .from(credentials)
    .where(
      and(
        eq(credentials.userId, userId),
        eq(credentials.kind, 'password'),
        eq(credentials.isActive, true),
      ),
    )
    .limit(1)
  return row !== undefined
}

// ─── Одноразовые ссылки и коды ──────────────────────────────────────────

/** Длинная ссылка: хранится быстрым отпечатком, перебирать нечего. */
export async function issueLink(email: string, purpose: TokenPurpose): Promise<string> {
  const db = getDb()
  const token = createLinkToken()
  await db.insert(loginTokens).values({
    id: uuidv7(),
    email: normalizeEmail(email),
    purpose,
    tokenHash: hashLinkToken(token),
    expiresAt: new Date(Date.now() + LINK_TTL_MINUTES * 60_000),
  })
  return token
}

/** Короткий код: шесть цифр, поэтому хранится медленным хэшем, как пароль. */
export async function issueCode(
  email: string,
  purpose: TokenPurpose,
  exec?: Executor,
): Promise<string> {
  const db = exec ?? getDb()
  const code = createConfirmationCode()
  await db.insert(loginTokens).values({
    id: uuidv7(),
    email: normalizeEmail(email),
    purpose,
    tokenHash: await hashSecret(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000),
  })
  return code
}

export async function consumeLink(token: string, purpose: TokenPurpose): Promise<string> {
  const db = getDb()
  const [row] = await db
    .select()
    .from(loginTokens)
    .where(and(eq(loginTokens.tokenHash, hashLinkToken(token)), eq(loginTokens.purpose, purpose)))
    .limit(1)

  if (!row) throw errors.tokenUnknown()
  if (row.usedAt) throw errors.tokenUsed()
  if (row.expiresAt.getTime() < Date.now()) throw errors.tokenExpired()

  await db.update(loginTokens).set({ usedAt: new Date() }).where(eq(loginTokens.id, row.id))
  return row.email
}

/**
 * Код ищется по адресу, а не по значению: шесть цифр не индекс.
 * Каждая неудачная попытка считается, после пяти код сгорает —
 * иначе миллион вариантов перебирается за вечер.
 */
export async function consumeCode(
  email: string,
  code: string,
  purpose: TokenPurpose,
): Promise<void> {
  const db = getDb()
  const [row] = await db
    .select()
    .from(loginTokens)
    .where(
      and(
        sql`lower(${loginTokens.email}) = ${normalizeEmail(email)}`,
        eq(loginTokens.purpose, purpose),
        sql`${loginTokens.usedAt} is null`,
      ),
    )
    .orderBy(desc(loginTokens.createdAt))
    .limit(1)

  if (!row) throw errors.tokenUnknown()
  if (row.expiresAt.getTime() < Date.now()) throw errors.tokenExpired()
  if (row.attempts >= MAX_CODE_ATTEMPTS) throw errors.tooManyAttempts(CODE_TTL_MINUTES)

  const ok = await verifySecret(normalizeCode(code), row.tokenHash)
  if (!ok) {
    await db
      .update(loginTokens)
      .set({ attempts: row.attempts + 1 })
      .where(eq(loginTokens.id, row.id))
    throw errors.tokenUnknown()
  }

  await db.update(loginTokens).set({ usedAt: new Date() }).where(eq(loginTokens.id, row.id))
}

// ─── Сессии ─────────────────────────────────────────────────────────────

export type SessionInfo = { token: string; expiresAt: Date; remembered: boolean }

export async function createSession(input: {
  userId: string
  remember: boolean
  ip?: string | undefined
  userAgent?: string | undefined
}): Promise<SessionInfo> {
  const db = getDb()
  const token = createLinkToken()
  const expiresAt = input.remember
    ? new Date(Date.now() + SESSION_DAYS_REMEMBERED * 86_400_000)
    : new Date(Date.now() + SESSION_HOURS_PLAIN * 3_600_000)

  await db.insert(sessions).values({
    id: uuidv7(),
    userId: input.userId,
    tokenHash: hashLinkToken(token),
    expiresAt,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
  })
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, input.userId))

  return { token, expiresAt, remembered: input.remember }
}

/** Возвращает пользователя сессии и продлевает её, но не чаще раза в сутки. */
export async function getSessionUser(token: string): Promise<User | null> {
  const db = getDb()
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, hashLinkToken(token)))
    .limit(1)

  if (!row) return null
  if (row.session.expiresAt.getTime() < Date.now()) return null
  if (!row.user.isActive) return null

  const sinceSeen = Date.now() - row.session.lastSeenAt.getTime()
  if (sinceSeen > SESSION_RENEW_AFTER_HOURS * 3_600_000) {
    const remembered =
      row.session.expiresAt.getTime() - row.session.createdAt.getTime() >
      SESSION_HOURS_PLAIN * 3_600_000 * 2
    await db
      .update(sessions)
      .set({
        lastSeenAt: new Date(),
        expiresAt: remembered
          ? new Date(Date.now() + SESSION_DAYS_REMEMBERED * 86_400_000)
          : row.session.expiresAt,
      })
      .where(eq(sessions.id, row.session.id))
  }

  return {
    id: row.user.id,
    orgId: row.user.orgId,
    email: row.user.email,
    emailVerified: row.user.emailVerifiedAt !== null,
    phone: row.user.phone,
    phoneVerified: row.user.phoneVerifiedAt !== null,
    fullName: row.user.fullName,
    position: row.user.position,
    role: row.user.role as User['role'],
    isActive: row.user.isActive,
  }
}

/** При выходе сессия удаляется из базы, а не помечается — её больше нет. */
export async function destroySession(token: string): Promise<void> {
  const db = getDb()
  await db.delete(sessions).where(eq(sessions.tokenHash, hashLinkToken(token)))
}

/** Отзыв доступа: все сессии человека перестают работать сразу. */
export async function destroyAllSessions(userId: string): Promise<void> {
  const db = getDb()
  await db.delete(sessions).where(eq(sessions.userId, userId))
}

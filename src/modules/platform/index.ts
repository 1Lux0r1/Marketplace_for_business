import { getDb } from '@/shared/db'
import * as auth from './auth'
import * as service from './service'
import { errors } from './errors'
import type { LegalForm, Org, Role, User } from './types'

/**
 * Публичный интерфейс модуля `platform`.
 *
 * ЕДИНСТВЕННОЕ, что видят соседи (§4.4). Здесь команды, запросы и типы;
 * `service.ts`, `auth.ts` и `schema.ts` наружу не выставляются — это проверяет линтер.
 *
 * Почта из модуля не отправляется. Команды выдают код или ссылку и возвращают
 * их вызывающему слою — он и доставляет. Так модуль остаётся проверяемым,
 * а отправка живёт в одном месте.
 */

export type { Org, User, Role, LegalForm }
export { PlatformError } from './errors'
export type { PlatformErrorCode } from './errors'

// ─── Компании ───────────────────────────────────────────────────────────

export const getOrg = service.getOrg
export const createOrg = service.createOrg
export const getPlatformOrg = service.getPlatformOrg

/** Включить роль подрядчика: отдельное действие, а не флажок при регистрации. */
export const enableContractorRole = service.enableContractorRole

// ─── Люди ───────────────────────────────────────────────────────────────

export const getUser = service.getUser
export const findUserByEmail = service.findUserByEmail

// ─── Права ──────────────────────────────────────────────────────────────

export const hasRole = service.hasRole
export const requireRole = service.requireRole
export const requireSameOrg = service.requireSameOrg

// ─── Регистрация ────────────────────────────────────────────────────────

export type RegisterInput = {
  legalForm: LegalForm
  companyName: string
  inn?: string | undefined
  fullName: string
  position?: string | undefined
  email: string
  phone: string
  password: string
}

/**
 * Регистрация: компания, человек, пароль и код подтверждения — одной операцией.
 * Код возвращается вызывающему слою для отправки на почту.
 *
 * Всё пишется в одной транзакции. Если что-то не так — в базе не остаётся
 * ни компании без владельца, ни владельца без пароля.
 *
 * До подтверждения почты войти нельзя: учётная запись создана, но не активна.
 */
export async function register(
  input: RegisterInput,
): Promise<{ userId: string; orgId: string; emailCode: string }> {
  // Сначала то, что видно без базы: иначе человек с кривым телефоном узнает
  // об этом только после того, как мы завели ему компанию
  service.assertEmail(input.email)
  service.assertPhone(input.phone)
  auth.assertPasswordStrength(input.password)

  return getDb().transaction(async (tx) => {
    // Понятный ответ раньше, чем сработает ограничение базы: иначе человек,
    // регистрирующий свою компанию второй раз, узнает про ИНН, а не про почту
    if (await service.findUserByEmail(input.email, tx)) throw errors.emailTaken()

    const org = await service.createOrg(
      {
        legalForm: input.legalForm,
        name: input.companyName,
        inn: input.inn,
      },
      tx,
    )

    const user = await service.createUser(
      {
        orgId: org.id,
        email: input.email,
        phone: input.phone,
        fullName: input.fullName,
        // Тот, кто завёл компанию, — её владелец. Роль выдаётся системой,
        // а не выбирается человеком: иначе любой объявит себя администратором
        role: 'owner',
        position: input.position,
      },
      tx,
    )

    await auth.setPassword(user.id, input.password, tx)
    const emailCode = await auth.issueCode(user.email, 'verify_email', tx)

    return { userId: user.id, orgId: org.id, emailCode }
  })
}

/** Подтверждение почты кодом из письма. После него учётная запись активна. */
export async function verifyEmail(input: { email: string; code: string }): Promise<void> {
  await auth.consumeCode(input.email, input.code, 'verify_email')
  const user = await service.findUserByEmail(input.email)
  if (!user) throw errors.userNotFound()
  await service.markEmailVerified(user.id)
}

/** Приглашение сотрудника: заводит человека и выдаёт ссылку на установку пароля. */
export async function inviteUser(input: {
  actor: Pick<User, 'id' | 'orgId' | 'role'>
  orgId: string
  email: string
  phone: string
  fullName: string
  role: Role
  position?: string | undefined
}): Promise<{ userId: string; setPasswordToken: string }> {
  service.requireSameOrg(input.actor, input.orgId)
  service.requireRole(input.actor, 'owner')
  // Нельзя пригласить человека с правами выше своих
  if (!service.hasRole(input.actor, input.role)) throw errors.forbidden()

  const user = await service.createUser({
    orgId: input.orgId,
    email: input.email,
    phone: input.phone,
    fullName: input.fullName,
    role: input.role,
    position: input.position,
  })
  const setPasswordToken = await auth.issueLink(user.email, 'set_password')
  return { userId: user.id, setPasswordToken }
}

/** Установка пароля по ссылке из приглашения или восстановления. */
export async function setPasswordByToken(input: {
  token: string
  password: string
  purpose?: 'set_password' | 'reset_password'
}): Promise<{ userId: string }> {
  const email = await auth.consumeLink(input.token, input.purpose ?? 'set_password')
  const user = await service.findUserByEmail(email)
  if (!user) throw errors.userNotFound()

  await auth.setPassword(user.id, input.password)
  // Ссылка пришла на почту, значит адрес подтверждён самим фактом перехода
  if (!user.emailVerified) await service.markEmailVerified(user.id)
  return { userId: user.id }
}

// ─── Вход ───────────────────────────────────────────────────────────────

export type LoginResult = { token: string; expiresAt: Date; user: User }

/** Вход по паролю. Поле логина принимает и почту, и подтверждённый телефон. */
export async function loginWithPassword(input: {
  login: string
  password: string
  remember: boolean
  ip?: string | undefined
  userAgent?: string | undefined
}): Promise<LoginResult> {
  await auth.assertCanTryPassword(input.login)

  const user = await service.findUserByLogin(input.login)
  const ok = user ? await auth.verifyPassword(user.id, input.password) : false

  await auth.recordAttempt({
    email: input.login,
    ip: input.ip,
    method: 'password',
    succeeded: ok,
  })

  // Один и тот же ответ для несуществующего логина и неверного пароля:
  // иначе форма входа отвечает на вопрос «кто у вас зарегистрирован»
  if (!ok || !user) throw errors.wrongCredentials()
  if (!user.emailVerified) throw errors.notVerified()
  if (!user.isActive) throw errors.wrongCredentials()

  const session = await auth.createSession({
    userId: user.id,
    remember: input.remember,
    ip: input.ip,
    userAgent: input.userAgent,
  })
  return { token: session.token, expiresAt: session.expiresAt, user }
}

/**
 * Запрос ссылки для входа на почту.
 *
 * Ответ одинаковый независимо от того, есть такой адрес или нет (решение
 * от 27.08.2026): иначе форма входа становится способом узнать состав
 * участников площадки. Ссылка возвращается только когда адрес существует.
 */
export async function startLogin(input: {
  email: string
  ip?: string | undefined
}): Promise<{ token: string | null }> {
  await auth.assertCanSendEmail(input.email, input.ip)
  await auth.recordAttempt({
    email: input.email,
    ip: input.ip,
    method: 'email_link',
    succeeded: true,
  })

  const user = await service.findUserByEmail(input.email)
  if (!user || !user.isActive) return { token: null }

  return { token: await auth.issueLink(user.email, 'login') }
}

export async function completeLogin(input: {
  token: string
  remember: boolean
  ip?: string | undefined
  userAgent?: string | undefined
}): Promise<LoginResult> {
  const email = await auth.consumeLink(input.token, 'login')
  const user = await service.findUserByEmail(email)
  if (!user || !user.isActive) throw errors.userNotFound()

  // Переход по ссылке из письма сам по себе подтверждает адрес
  if (!user.emailVerified) await service.markEmailVerified(user.id)

  const session = await auth.createSession({
    userId: user.id,
    remember: input.remember,
    ip: input.ip,
    userAgent: input.userAgent,
  })
  return { token: session.token, expiresAt: session.expiresAt, user: { ...user, emailVerified: true } }
}

export const getSession = auth.getSessionUser
export const logout = auth.destroySession
export const revokeAllSessions = auth.destroyAllSessions
export const hasPassword = auth.hasPassword

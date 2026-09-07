'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import * as platform from '@/modules/platform'
import * as notifications from '@/modules/notifications'
import { logger } from '@/shared/logger'
import { startSession, endSession } from '@/server/session'
import {
  loginSchema,
  registerSchema,
  resendSchema,
  setPasswordSchema,
  verifySchema,
} from './auth-schemas'

/**
 * Команды форм входа и регистрации.
 *
 * Каждая проверяет вход Zod-схемой заново (§6): проверка в форме — удобство,
 * а не защита, и до этой строки долетает всё что угодно.
 *
 * Наружу возвращается либо `ok`, либо текст для человека. Технических кодов
 * и следов исключений в ответе нет: они уходят в журнал.
 */

export type FormResult =
  | { ok: true; message?: string | undefined }
  | { ok: false; error: string; field?: string | undefined }

export async function registerAction(input: unknown): Promise<FormResult> {
  const parsed = registerSchema.safeParse(input)
  if (!parsed.success) return firstIssue(parsed.error)

  const data = parsed.data
  // Юрлицу и ИП название даёт справочник по ИНН, физлицу — собственное имя
  const companyName =
    data.legalForm === 'individual' ? data.fullName : (data.companyName ?? '')
  const { ip } = await visitor()

  try {
    const { emailCode } = await platform.register({ ...data, companyName, ip })
    await notifications.sendEmail({
      to: data.email,
      template: 'verify_email',
      fullName: data.fullName,
      code: emailCode,
    })
    return { ok: true, message: 'Код отправлен на почту' }
  } catch (error: unknown) {
    return asFormResult(error, 'регистрация не прошла')
  }
}

/**
 * Выслать код ещё раз.
 *
 * Без этого регистрация — дорога в один конец: письмо не дошло или код протух,
 * а войти нельзя, потому что почта не подтверждена, и зарегистрироваться
 * заново нельзя, потому что адрес занят.
 *
 * Ответ один и тот же независимо от того, есть такой адрес или нет: иначе
 * форма превращается в способ узнать, кто зарегистрирован на площадке.
 */
export async function resendCodeAction(input: unknown): Promise<FormResult> {
  const parsed = resendSchema.safeParse(input)
  if (!parsed.success) return firstIssue(parsed.error)

  const { ip } = await visitor()
  try {
    const { code, fullName } = await platform.resendEmailCode({ email: parsed.data.email, ip })
    if (code) {
      await notifications.sendEmail({
        to: parsed.data.email,
        template: 'verify_email',
        fullName: fullName ?? undefined,
        code,
      })
    }
    return { ok: true, message: 'Если учётная запись ждёт подтверждения, код уже в пути' }
  } catch (error: unknown) {
    return asFormResult(error, 'повторная отправка кода не прошла')
  }
}

export async function verifyEmailAction(input: unknown): Promise<FormResult> {
  const parsed = verifySchema.safeParse(input)
  if (!parsed.success) return firstIssue(parsed.error)

  try {
    // Код доказал, что почта его, а пароль он задал сам в форме регистрации —
    // впускаем сразу, вместо того чтобы просить тот же пароль ещё раз
    const { token } = await platform.verifyEmail({ ...parsed.data, ...(await visitor()) })
    await startSession(token, false)
    revalidatePath('/')
    return { ok: true, message: 'Учётная запись включена — вы вошли' }
  } catch (error: unknown) {
    return asFormResult(error, 'подтверждение почты не прошло')
  }
}

export async function loginAction(input: unknown): Promise<FormResult> {
  const parsed = loginSchema.safeParse(input)
  if (!parsed.success) return firstIssue(parsed.error)

  try {
    const { token } = await platform.loginWithPassword({ ...parsed.data, ...(await visitor()) })
    await startSession(token, parsed.data.remember)
    revalidatePath('/')
    return { ok: true }
  } catch (error: unknown) {
    return asFormResult(error, 'вход не прошёл')
  }
}

/**
 * Установка пароля по ссылке из приглашения.
 *
 * Сразу входим: человек только что доказал, что владеет почтой, переходом
 * по ссылке. Требовать после этого ввести пароль ещё раз — лишний шаг там,
 * где он ничего не проверяет.
 */
export async function setPasswordAction(input: unknown): Promise<FormResult> {
  const parsed = setPasswordSchema.safeParse(input)
  if (!parsed.success) return firstIssue(parsed.error)

  try {
    const { userId } = await platform.setPasswordByToken(parsed.data)
    const user = await platform.getUser(userId)
    const session = await platform.loginWithPassword({
      login: user.email,
      password: parsed.data.password,
      remember: false,
    })
    await startSession(session.token, false)
    return { ok: true, message: 'Пароль сохранён' }
  } catch (error: unknown) {
    return asFormResult(error, 'не удалось установить пароль')
  }
}

export async function logoutAction(): Promise<void> {
  await endSession()
  revalidatePath('/')
}

// ─── Общее ──────────────────────────────────────────────────────────────

/** Кто и откуда пришёл — для ограничения частоты попыток и для журнала. */
async function visitor(): Promise<{ ip?: string | undefined; userAgent?: string | undefined }> {
  const h = await headers()
  return {
    // За обратным прокси настоящий адрес приходит заголовком
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    userAgent: h.get('user-agent') ?? undefined,
  }
}

function firstIssue(error: z.ZodError): FormResult {
  const issue = error.issues[0]
  return {
    ok: false,
    error: issue?.message ?? 'Проверьте заполнение формы',
    field: issue?.path[0]?.toString(),
  }
}

/**
 * Ошибку модуля показываем как есть — она написана для человека.
 * Всё остальное — это «у нас сломалось»: в журнал целиком, человеку общее.
 */
function asFormResult(error: unknown, what: string): FormResult {
  if (error instanceof platform.PlatformError) return { ok: false, error: error.message }
  logger().error({ err: error }, what)
  return {
    ok: false,
    error: 'Не получилось — на нашей стороне. Попробуйте ещё раз через минуту.',
  }
}

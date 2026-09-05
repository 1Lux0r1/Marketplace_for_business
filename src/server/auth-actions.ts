'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import * as platform from '@/modules/platform'
import * as notifications from '@/modules/notifications'
import { logger } from '@/shared/logger'
import { startSession, endSession } from '@/server/session'

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

const registerSchema = z.object({
  legalForm: z.enum(['individual', 'sole_trader', 'company']),
  companyName: z.string().trim().min(2, 'Укажите название — по нему вас найдут заказчики'),
  inn: z.string().trim().optional(),
  fullName: z.string().trim().min(3, 'Укажите фамилию и имя'),
  position: z.string().trim().optional(),
  email: z.email('Проверьте адрес почты: похоже, в нём опечатка'),
  phone: z.string().trim().min(1, 'Телефон нужен: по нему с вами свяжется подрядчик'),
  password: z.string(),
})

const loginSchema = z.object({
  login: z.string().trim().min(1, 'Введите почту или телефон'),
  password: z.string().min(1, 'Введите пароль'),
  remember: z.boolean(),
})

const verifySchema = z.object({
  email: z.email(),
  code: z.string().trim().min(1, 'Введите код из письма'),
})

export async function registerAction(input: unknown): Promise<FormResult> {
  const parsed = registerSchema.safeParse(input)
  if (!parsed.success) return firstIssue(parsed.error)

  const data = parsed.data
  // Юрлицу и ИП название даёт справочник по ИНН, физлицу — собственное имя
  const companyName = data.legalForm === 'individual' ? data.fullName : data.companyName

  try {
    const { emailCode } = await platform.register({ ...data, companyName })
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

export async function verifyEmailAction(input: unknown): Promise<FormResult> {
  const parsed = verifySchema.safeParse(input)
  if (!parsed.success) return firstIssue(parsed.error)

  try {
    await platform.verifyEmail(parsed.data)
    revalidatePath('/')
    return { ok: true, message: 'Учётная запись включена. Теперь можно войти.' }
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

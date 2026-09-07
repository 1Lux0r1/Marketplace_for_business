'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import * as platform from '@/modules/platform'
import * as notifications from '@/modules/notifications'
import { config } from '@/shared/config'
import { logger } from '@/shared/logger'
import { requireUser } from './company-queries'

/**
 * Команды кабинета клиента.
 *
 * Каждая заново спрашивает, кто пришёл, и передаёт этого человека модулю —
 * права проверяет он (§6). Экран мог отрисоваться когда угодно, а команда
 * выполняется сейчас и по чужой воле тоже.
 */

export type FormResult =
  | { ok: true; id?: string | undefined; message?: string | undefined }
  | { ok: false; error: string }

const siteSchema = z.object({
  name: z.string().trim().min(2, 'Назовите точку так, как называете её сами'),
  address: z.string().trim().min(5, 'Укажите адрес точки'),
  zoneCode: z.string().trim().min(1, 'Выберите зону из списка'),
  contactName: z.string().trim().optional(),
  contactPhone: z.string().trim().optional(),
  note: z.string().trim().optional(),
})

export async function addSiteAction(input: unknown): Promise<FormResult> {
  const access = await requireUser()
  if (!access.allowed) return { ok: false, error: 'Нужно войти' }

  const parsed = siteSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Проверьте заполнение формы' }
  }

  try {
    const site = await platform.addSite({
      actor: access.user,
      orgId: access.user.orgId,
      ...parsed.data,
    })
    revalidatePath('/company')
    return { ok: true, id: site.id, message: `Точка «${site.name}» добавлена` }
  } catch (error: unknown) {
    return asFormResult(error, 'не удалось добавить точку')
  }
}

export async function updateSiteAction(input: unknown): Promise<FormResult> {
  const access = await requireUser()
  if (!access.allowed) return { ok: false, error: 'Нужно войти' }

  const parsed = siteSchema.extend({ siteId: z.uuid() }).safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Проверьте заполнение формы' }
  }

  try {
    const { siteId, ...fields } = parsed.data
    const site = await platform.updateSite({ actor: access.user, siteId, ...fields })
    revalidatePath('/company')
    return { ok: true, id: site.id, message: 'Изменения сохранены' }
  } catch (error: unknown) {
    return asFormResult(error, 'не удалось сохранить точку')
  }
}

/** Точка убирается в архив, а не удаляется: на неё ссылаются заявки и сделки. */
export async function archiveSiteAction(input: unknown): Promise<FormResult> {
  const access = await requireUser()
  if (!access.allowed) return { ok: false, error: 'Нужно войти' }

  const parsed = z.object({ siteId: z.uuid(), archived: z.boolean() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Проверьте заполнение формы' }

  try {
    if (parsed.data.archived) await platform.archiveSite(access.user, parsed.data.siteId)
    else await platform.restoreSite(access.user, parsed.data.siteId)
    revalidatePath('/company')
    return { ok: true, message: parsed.data.archived ? 'Точка убрана' : 'Точка снова в списке' }
  } catch (error: unknown) {
    return asFormResult(error, 'не удалось изменить точку')
  }
}

export async function updateCompanyAction(input: unknown): Promise<FormResult> {
  const access = await requireUser()
  if (!access.allowed) return { ok: false, error: 'Нужно войти' }

  const parsed = z
    .object({
      name: z.string().trim().min(2, 'Укажите название компании'),
      kpp: z.string().trim().optional(),
      legalAddress: z.string().trim().optional(),
    })
    .safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Проверьте заполнение формы' }
  }

  try {
    await platform.updateOrg({ actor: access.user, orgId: access.user.orgId, ...parsed.data })
    revalidatePath('/company')
    return { ok: true, message: 'Реквизиты сохранены' }
  } catch (error: unknown) {
    return asFormResult(error, 'не удалось сохранить реквизиты')
  }
}

/**
 * Приглашение сотрудника.
 *
 * Ссылка на установку пароля уходит письмом прямо отсюда, а не через очередь
 * событий: очередь хранит содержимое открытым текстом, а эта ссылка — вход
 * в учётную запись. В очереди ей не место.
 */
export async function inviteAction(input: unknown): Promise<FormResult> {
  const access = await requireUser()
  if (!access.allowed) return { ok: false, error: 'Нужно войти' }

  const parsed = z
    .object({
      fullName: z.string().trim().min(2, 'Укажите фамилию и имя'),
      email: z.string().trim().min(3, 'Укажите почту'),
      phone: z.string().trim().min(5, 'Укажите телефон'),
      position: z.string().trim().optional(),
      role: z.enum(['owner', 'staff']),
    })
    .safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Проверьте заполнение формы' }
  }

  try {
    const { setPasswordToken } = await platform.inviteUser({
      actor: access.user,
      orgId: access.user.orgId,
      ...parsed.data,
    })
    await notifications.sendEmail({
      to: parsed.data.email,
      template: 'set_password',
      fullName: parsed.data.fullName,
      url: `${config().APP_URL}/password?token=${setPasswordToken}`,
    })
    revalidatePath('/company')
    return { ok: true, message: `Пригласили ${parsed.data.fullName}. Письмо ушло.` }
  } catch (error: unknown) {
    return asFormResult(error, 'не удалось пригласить сотрудника')
  }
}

/**
 * Ошибку модуля показываем как есть — она написана для человека.
 * Всё остальное — «у нас сломалось»: в журнал целиком, человеку общее.
 */
function asFormResult(error: unknown, what: string): FormResult {
  if (error instanceof platform.PlatformError) return { ok: false, error: error.message }
  logger().error({ err: error }, what)
  return { ok: false, error: 'Не получилось — на нашей стороне. Попробуйте ещё раз через минуту.' }
}

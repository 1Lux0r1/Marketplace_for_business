'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import * as intake from '@/modules/intake'
import * as platform from '@/modules/platform'
import { logger } from '@/shared/logger'
import { requireUser } from './request-queries'

/**
 * Команды заявки.
 *
 * Права проверяет модуль: ему передаётся человек, а не признак «можно».
 * Экран мог отрисоваться когда угодно, команда выполняется сейчас.
 */

export type FormResult =
  | { ok: true; id?: string | undefined; number?: number | undefined; message?: string | undefined }
  | { ok: false; error: string }

const schema = z.object({
  siteId: z.uuid('Выберите точку из списка'),
  rawText: z
    .string()
    .trim()
    .min(10, 'Опишите задачу хотя бы одним предложением — так подрядчики поймут, о чём речь'),
  categoryId: z.uuid().optional(),
  urgency: z.enum(['normal', 'urgent', 'planned']).default('normal'),
  contactName: z.string().trim().optional(),
  contactPhone: z.string().trim().optional(),
  desiredAt: z.string().trim().optional(),
})

export async function createRequestAction(input: unknown): Promise<FormResult> {
  const access = await requireUser()
  if (!access.allowed) return { ok: false, error: 'Нужно войти' }

  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Проверьте заполнение формы' }
  }

  // Дата приходит из формы строкой. Пустую и невнятную отбрасываем молча:
  // это поле необязательное, и падать из-за него не за что
  const desired = parsed.data.desiredAt ? new Date(parsed.data.desiredAt) : undefined
  const desiredAt = desired && !Number.isNaN(desired.valueOf()) ? desired : undefined

  try {
    const request = await intake.createRequest({
      actor: access.user,
      siteId: parsed.data.siteId,
      rawText: parsed.data.rawText,
      categoryId: parsed.data.categoryId,
      urgency: parsed.data.urgency,
      contactName: parsed.data.contactName,
      contactPhone: parsed.data.contactPhone,
      desiredAt,
    })

    revalidatePath('/orders')
    revalidatePath('/operator/requests')
    return {
      ok: true,
      id: request.id,
      number: request.number,
      message: `Задача №${request.number} отправлена`,
    }
  } catch (error: unknown) {
    if (error instanceof intake.IntakeError) return { ok: false, error: error.message }
    if (error instanceof platform.PlatformError) return { ok: false, error: error.message }
    logger().error({ err: error }, 'не удалось создать заявку')
    return { ok: false, error: 'Не получилось — на нашей стороне. Попробуйте ещё раз через минуту.' }
  }
}

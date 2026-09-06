'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import * as catalog from '@/modules/catalog'
import * as platform from '@/modules/platform'
import { logger } from '@/shared/logger'
import { requireOperator } from './catalog-queries'

/**
 * Команды экранов оператора.
 *
 * Каждая проверяет право заново (§6): экран мог отрисоваться когда угодно,
 * а команда выполняется сейчас и по чужой воле тоже.
 */

export type FormResult =
  | { ok: true; id?: string | undefined; message?: string | undefined }
  | { ok: false; error: string }

const createSchema = z.object({
  inn: z.string().trim().min(8, 'Укажите ИНН компании'),
  status: z.enum(['draft', 'active', 'paused', 'blocked']),
  manualRating: z.coerce.number().int().min(1).max(5).optional(),
  notes: z.string().trim().optional(),
  categoryIds: z.array(z.string()).default([]),
  zoneCodes: z.array(z.string()).default([]),
})

/**
 * Завести подрядчика целиком за один экран: компания, статус, категории, зоны.
 *
 * Компания ищется по ИНН среди уже зарегистрированных. Заводить её отсюда
 * оператор не может намеренно: компания появляется, когда регистрируется сама,
 * иначе в базе заведутся две записи на одно юрлицо.
 */
export async function createContractorAction(input: unknown): Promise<FormResult> {
  const access = await requireOperator()
  if (!access.allowed) return { ok: false, error: 'Нужны права оператора' }

  const parsed = createSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Проверьте заполнение формы' }
  }
  const data = parsed.data

  try {
    const org = await platform.findOrgByInn(data.inn)
    if (!org) {
      return {
        ok: false,
        error: 'Компании с таким ИНН нет в системе. Она должна сначала зарегистрироваться.',
      }
    }

    const contractor = await catalog.createContractor({
      orgId: org.id,
      status: data.status,
      manualRating: data.manualRating,
      notes: data.notes,
    })
    await catalog.setContractorCategories(contractor.id, data.categoryIds)
    await catalog.setContractorZones(contractor.id, data.zoneCodes)

    revalidatePath('/operator/contractors')
    return { ok: true, id: contractor.id, message: `${org.name} заведён как подрядчик` }
  } catch (error: unknown) {
    return asFormResult(error, 'не удалось завести подрядчика')
  }
}

const updateSchema = z.object({
  contractorId: z.uuid(),
  status: z.enum(['draft', 'active', 'paused', 'blocked']),
  categoryIds: z.array(z.string()).default([]),
  zoneCodes: z.array(z.string()).default([]),
})

export async function updateContractorAction(input: unknown): Promise<FormResult> {
  const access = await requireOperator()
  if (!access.allowed) return { ok: false, error: 'Нужны права оператора' }

  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Проверьте заполнение формы' }
  }
  const data = parsed.data

  try {
    await catalog.setContractorStatus(data.contractorId, data.status)
    await catalog.setContractorCategories(data.contractorId, data.categoryIds)
    await catalog.setContractorZones(data.contractorId, data.zoneCodes)

    revalidatePath('/operator/contractors')
    return { ok: true, message: 'Сохранено' }
  } catch (error: unknown) {
    return asFormResult(error, 'не удалось сохранить подрядчика')
  }
}

/**
 * Ошибку модуля показываем как есть — она написана для человека.
 * Всё остальное — «у нас сломалось»: в журнал целиком, человеку общее.
 */
function asFormResult(error: unknown, what: string): FormResult {
  if (error instanceof catalog.CatalogError) return { ok: false, error: error.message }
  if (error instanceof platform.PlatformError) return { ok: false, error: error.message }
  logger().error({ err: error }, what)
  return { ok: false, error: 'Не получилось — на нашей стороне. Попробуйте ещё раз через минуту.' }
}

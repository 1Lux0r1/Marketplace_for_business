'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import * as admin from '@/modules/admin'
import * as catalog from '@/modules/catalog'
import * as platform from '@/modules/platform'
import * as notifications from '@/modules/notifications'
import { getDb } from '@/shared/db'
import { logger } from '@/shared/logger'
import { MANUAL_VERDICT, requireOperator } from './catalog-queries'

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

    await admin.logChange(getDb(), {
      actor: actorOf(access.user),
      action: 'contractor.created',
      entity: 'catalog.contractor',
      entityId: contractor.id,
      entityLabel: await contractorLabel(contractor.id),
      after: snapshot(await catalog.getContractor(contractor.id)),
    })

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
    // Читаем ДО изменения: «было» взять больше неоткуда, а журнал без «было»
    // не отвечает на вопрос, ради которого его заводили
    const was = await catalog.getContractor(data.contractorId)

    await catalog.setContractorStatus(data.contractorId, data.status)
    await catalog.setContractorCategories(data.contractorId, data.categoryIds)
    await catalog.setContractorZones(data.contractorId, data.zoneCodes)

    // Читаем и ПОСЛЕ: «стало» пишется названиями, а не списком идентификаторов.
    // «категории: 3 штуки» на вопрос «что изменилось» не отвечает
    const now = await catalog.getContractor(data.contractorId)

    await admin.logChange(getDb(), {
      actor: actorOf(access.user),
      action: 'contractor.updated',
      entity: 'catalog.contractor',
      entityId: data.contractorId,
      entityLabel: await contractorLabel(data.contractorId),
      before: snapshot(was),
      after: snapshot(now),
    })

    revalidatePath('/operator/contractors')
    return { ok: true, message: 'Сохранено' }
  } catch (error: unknown) {
    return asFormResult(error, 'не удалось сохранить подрядчика')
  }
}

// ─── Саморегистрация подрядчика ─────────────────────────────────────────

const joinSchema = z.object({
  inn: z.string().trim().min(8, 'Укажите ИНН'),
  legalForm: z.enum(['individual', 'sole_trader', 'company']),
  companyName: z.string().trim().min(2, 'Укажите название — по нему вас найдут заказчики'),
  fullName: z.string().trim().min(3, 'Укажите фамилию и имя'),
  position: z.string().trim().optional(),
  email: z.email('Проверьте адрес почты: похоже, в нём опечатка'),
  phone: z.string().trim().min(1, 'Телефон нужен: по нему с вами свяжется заказчик'),
  password: z.string(),
})

/**
 * Подрядчик заводит себя сам. Публичная команда — прав тут не спрашиваем,
 * человек ещё никто в системе.
 *
 * Справочник ИНН здесь не дёргается: проверка идёт следом отдельным процессом.
 * Иначе чужой недоступный сервис отказывал бы в регистрации.
 */
export async function joinAsContractorAction(input: unknown): Promise<FormResult> {
  const parsed = joinSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Проверьте заполнение формы' }
  }

  try {
    const { contractorId, emailCode } = await catalog.registerContractor(parsed.data)
    if (emailCode) {
      await notifications.sendEmail({
        to: parsed.data.email,
        template: 'verify_email',
        fullName: parsed.data.fullName,
        code: emailCode,
      })
    }
    return {
      ok: true,
      id: contractorId,
      message: 'Заявка принята. Проверим ИНН и включим вас в каталог.',
    }
  } catch (error: unknown) {
    return asFormResult(error, 'не удалось зарегистрировать подрядчика')
  }
}

/** Оператор решает вручную, когда справочник не помог. */
export async function decideVerificationAction(input: unknown): Promise<FormResult> {
  const access = await requireOperator()
  if (!access.allowed) return { ok: false, error: 'Нужны права оператора' }

  const parsed = z
    .object({ contractorId: z.uuid(), verified: z.boolean(), note: z.string().trim().optional() })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Проверьте заполнение формы' }

  try {
    await catalog.applyInnVerdict({
      contractorId: parsed.data.contractorId,
      verified: parsed.data.verified,
      // Кто решил и почему — часть ответа на вопрос «на основании чего пустили»
      details: {
        status: MANUAL_VERDICT,
        decidedBy: access.user.id,
        note: parsed.data.note ?? null,
      },
    })
    await admin.logChange(getDb(), {
      actor: actorOf(access.user),
      action: parsed.data.verified ? 'contractor.verified' : 'contractor.rejected',
      entity: 'catalog.contractor',
      entityId: parsed.data.contractorId,
      entityLabel: await contractorLabel(parsed.data.contractorId),
      after: { verified: parsed.data.verified },
      reason: parsed.data.note,
    })

    revalidatePath('/operator/verification')
    return { ok: true, message: parsed.data.verified ? 'Подрядчик включён' : 'Отклонено' }
  } catch (error: unknown) {
    return asFormResult(error, 'не удалось записать решение')
  }
}

/**
 * Что записать в журнал про подрядчика — названиями, а не идентификаторами.
 *
 * Журнал читают через полгода, и «категории: 3 штуки» на вопрос «что
 * изменилось» не отвечает. А идентификаторы не отвечают тем более.
 */
function snapshot(card: Awaited<ReturnType<typeof catalog.getContractor>>): Record<string, unknown> {
  return {
    status: card.status,
    categories: card.categories.map((category) => category.name),
    zones: card.zones.map((zone) => zone.name),
  }
}

/**
 * Автор действия — снимком: журнал обязан читаться и через год, когда этого
 * человека уже не будет в системе (см. `modules/admin/schema.ts`).
 */
function actorOf(user: platform.User): admin.Actor {
  return { id: user.id, fullName: user.fullName, role: user.role }
}

/**
 * Как человек называет подрядчика. Без этого в журнале останется
 * идентификатор, по которому через полгода ничего не узнать.
 *
 * Название не критично: не нашлось — запись всё равно должна появиться,
 * иначе сбой на подписи уронит само действие.
 */
async function contractorLabel(contractorId: string): Promise<string | undefined> {
  try {
    const contractor = await catalog.getContractor(contractorId)
    const org = await platform.getOrg(contractor.orgId)
    return org.name
  } catch {
    return undefined
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

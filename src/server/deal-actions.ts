'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import * as deal from '@/modules/deal'
import * as documents from '@/modules/documents'
import * as platform from '@/modules/platform'
import { logger } from '@/shared/logger'
import { requireUser } from './session'

/**
 * Команды сделки.
 *
 * Статус меняет модуль, а не эти функции: здесь только «кто пришёл» и перевод
 * ошибки в текст. Проверку перехода нельзя дублировать тут — два места
 * с одним правилом однажды разойдутся, и разойдутся они на деньгах (§8).
 */

export type FormResult =
  | { ok: true; id?: string | undefined; number?: number | undefined; message?: string | undefined }
  | { ok: false; error: string }

export async function orderFromCatalogAction(input: unknown): Promise<FormResult> {
  const access = await requireUser()
  if (!access.allowed) return { ok: false, error: 'Нужно войти' }

  const parsed = z
    .object({
      listingId: z.uuid(),
      siteId: z.uuid('Выберите точку, куда приехать'),
      qty: z.string().trim().optional(),
    })
    .safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Проверьте заполнение формы' }
  }

  try {
    const made = await deal.createFromListing({ actor: access.user, ...parsed.data })
    revalidatePath('/orders')
    return {
      ok: true,
      id: made.id,
      number: made.number,
      message: `Заказ №${made.number} оформлен`,
    }
  } catch (error: unknown) {
    return asFormResult(error, 'не удалось оформить заказ')
  }
}

export async function moveDealAction(input: unknown): Promise<FormResult> {
  const access = await requireUser()
  if (!access.allowed) return { ok: false, error: 'Нужно войти' }

  const parsed = z
    .object({
      dealId: z.uuid(),
      to: z.enum(deal.DEAL_STATUSES),
      reason: z.string().trim().optional(),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Проверьте заполнение формы' }

  try {
    /**
     * «Принять работу» — это подписание акта, а не смена состояния.
     *
     * Акт подписывается ДО перевода сделки: если подписать не удалось,
     * сделка не должна оказаться принятой. Обратный порядок дал бы принятую
     * работу без документа, по которому её приняли, — то есть ровно ту дыру,
     * ради закрытия которой документы и делались (§8).
     */
    if (parsed.data.to === 'act_signed') {
      await signActFor(parsed.data.dealId, access.user)
    }

    let moved = await deal.moveTo({ actor: access.user, ...parsed.data })

    /**
     * Подписанный акт закрывает сделку сразу.
     *
     * ВРЕМЕННО, и вот почему: между «акт подписан» и «сделка закрыта» должны
     * стоять проверка подписи и начисление комиссии, а модулей документов
     * и выплат ещё нет. Если ничего не делать, сделка встанет на подписанном
     * акте навсегда — двигать её будет некому.
     *
     * Два статуса при этом остаются: когда документы и выплаты появятся,
     * между ними встанет их работа, и эта склейка уйдёт. История сделки
     * покажет оба шага, а не один.
     */
    if (moved.status === 'act_signed') {
      moved = await deal.moveTo({ actor: access.user, dealId: moved.id, to: 'completed' })
    }

    revalidatePath('/orders')
    revalidatePath('/works')
    return { ok: true, id: moved.id, message: 'Готово' }
  } catch (error: unknown) {
    return asFormResult(error, 'не удалось изменить заказ')
  }
}

/**
 * Подписать акт по сделке.
 *
 * Пока оператор ЭДО не выбран (Q24), проверять электронную подпись нечем,
 * и документ выпускается по бумажному пути — отметить его подписанным может
 * только наш сотрудник, сверив скан. Клиент, нажимающий «принять работу»,
 * получает об этом понятный ответ, а не молчаливый отказ.
 */
async function signActFor(dealId: string, user: platform.User): Promise<void> {
  const issued = await documents.listForDeal(dealId)
  const act = issued.find((doc) => doc.kind === 'act' && doc.status !== 'void')

  if (!act) {
    throw new documents.DocumentError(
      'document_not_found',
      'Акт по этому заказу ещё не выставлен. Подрядчик выставит его, когда закончит работу.',
    )
  }
  if (act.status === 'signed') return

  await documents.markSigned({
    documentId: act.id,
    byOperator: platform.hasRole(user, 'operator'),
    signedBy: user.id,
    signature: {
      /**
       * Чем подтверждена подпись — записываем как есть.
       *
       * `simple` это простая электронная подпись: человек вошёл в систему
       * и нажал «принять». Это НЕ усиленная квалифицированная подпись,
       * и называть её так в записи было бы враньём, которое всплывёт
       * в первом же споре. Когда появится оператор ЭДО (Q24), здесь будет
       * его ответ о проверке и `kind: 'укэп'`.
       */
      kind: 'simple',
      by: user.fullName,
      userId: user.id,
      at: new Date().toISOString(),
    },
  })
}

function asFormResult(error: unknown, what: string): FormResult {
  if (error instanceof deal.DealError) return { ok: false, error: error.message }
  if (error instanceof documents.DocumentError) return { ok: false, error: error.message }
  if (error instanceof platform.PlatformError) return { ok: false, error: error.message }
  logger().error({ err: error }, what)
  return { ok: false, error: 'Не получилось — на нашей стороне. Попробуйте ещё раз через минуту.' }
}

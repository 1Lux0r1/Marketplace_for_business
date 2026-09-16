/**
 * Ошибки модуля. У каждой есть текст для человека — без извинений,
 * без «произошла ошибка», без кодов без объяснения (§7.4).
 */
export class DealError extends Error {
  constructor(
    readonly code: DealErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'DealError'
  }
}

export type DealErrorCode =
  | 'deal_not_found'
  | 'bad_deal'
  | 'forbidden'
  | 'bad_transition'
  | 'needs_operator'
  | 'reason_required'

export const errors = {
  dealNotFound: () => new DealError('deal_not_found', 'Такого заказа нет'),
  badDeal: (why: string) => new DealError('bad_deal', why),
  forbidden: () => new DealError('forbidden', 'Этот заказ не ваш'),
  badTransition: (from: string, to: string) =>
    new DealError(
      'bad_transition',
      `Так нельзя: заказ сейчас в состоянии «${from}», и перевести его в «${to}» отсюда невозможно.`,
    ),
  needsOperator: () =>
    new DealError(
      'needs_operator',
      'Спор закрывает наш сотрудник, а не сторона спора. Мы разберёмся и сообщим решение.',
    ),
  reasonRequired: () =>
    new DealError('reason_required', 'Напишите причину — её увидит вторая сторона'),
}

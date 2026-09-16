import type { DealSource, DealStatus } from './types'

/**
 * Переходы статусов сделки. ЭТО САМЫЙ ВАЖНЫЙ ФАЙЛ МОДУЛЯ.
 *
 * Здесь записано обещание продукта: деньги не уходят подрядчику раньше
 * подписанного акта (§1, §8). Не комментарием, а таблицей, по которой
 * работает код: в `completed` нельзя попасть иначе как из `act_signed`
 * или из `disputed` решением оператора. Другого пути нет — не «не принято
 * так делать», а не описан.
 *
 * Переходы, которых здесь нет, запрещены и падают с понятной ошибкой.
 */

/**
 * Куда можно из каждого статуса.
 *
 * Пустой список — конечный статус: из `completed` и `cancelled` дороги нет.
 * Сделку не «переоткрывают»: если после закрытия что-то пошло не так,
 * это новая сделка или разбор оператором, а не правка старой задним числом.
 */
const NEXT: Record<DealStatus, readonly DealStatus[]> = {
  // Из каталога — сразу к подрядчику; из заявки — в подбор.
  // Какой из двух разрешён, решает происхождение сделки, см. ORIGIN_ONLY
  new: ['accepted', 'matching', 'cancelled'],

  matching: ['quoted', 'cancelled'],
  quoted: ['accepted', 'cancelled'],

  /**
   * Оплата ДО начала работ, а не после.
   *
   * ДОПУЩЕНИЕ, И ОНО ЖДЁТ ВАШЕГО СЛОВА (Q22). `docs/02-modules.md` рисует
   * обратный порядок: `in_progress → paid`. Но тогда подрядчик работает
   * раньше, чем деньги клиента оказались у площадки, и удерживать в случае
   * спора нечего — а удержание и есть то, за что берётся комиссия (§1).
   * Поэтому здесь порядок «сначала деньги у площадки, потом работа».
   */
  accepted: ['paid', 'cancelled'],
  paid: ['in_progress', 'disputed', 'cancelled'],

  in_progress: ['act_issued', 'disputed', 'cancelled'],

  /** Акт выставлен, клиент его ещё не подписал. */
  act_issued: ['act_signed', 'disputed'],

  /** Акт подписан — И ТОЛЬКО ОТСЮДА открывается путь к выплате. */
  act_signed: ['completed', 'disputed'],

  /**
   * Рекламация. Выход из неё — решение оператора, и оба выхода есть:
   * работа всё-таки принята либо сделка закрыта без приёмки.
   */
  disputed: ['completed', 'cancelled'],

  completed: [],
  cancelled: [],
}

/**
 * Переходы, разрешённые только одному происхождению сделки.
 *
 * Перепутать их — значит дать клиенту зафиксировать цену, которой никто
 * не называл: у сделки из заявки цены в момент создания ещё нет.
 */
const ORIGIN_ONLY: Partial<Record<`${DealStatus}->${DealStatus}`, DealSource>> = {
  'new->accepted': 'catalog',
  'new->matching': 'request',
}

/**
 * Переходы, которые может сделать только оператор.
 *
 * Выход из рекламации — не кнопка у сторон спора: у обеих есть интерес,
 * и решать должен тот, кто не сторона.
 */
const OPERATOR_ONLY: ReadonlySet<`${DealStatus}->${DealStatus}`> = new Set([
  'disputed->completed',
  'disputed->cancelled',
])

/** Статусы, из которых выплата подрядчику уже невозможна. */
export const FINAL: ReadonlySet<DealStatus> = new Set<DealStatus>(['completed', 'cancelled'])

export type TransitionCheck =
  | { ok: true }
  | { ok: false; reason: 'unknown' | 'origin' | 'operator_only' }

export function canMove(input: {
  from: DealStatus
  to: DealStatus
  source: DealSource
  byOperator: boolean
}): TransitionCheck {
  if (!NEXT[input.from].includes(input.to)) return { ok: false, reason: 'unknown' }

  const key = `${input.from}->${input.to}` as const
  const onlyFor = ORIGIN_ONLY[key]
  if (onlyFor && onlyFor !== input.source) return { ok: false, reason: 'origin' }

  if (OPERATOR_ONLY.has(key) && !input.byOperator) return { ok: false, reason: 'operator_only' }

  return { ok: true }
}

/** Куда вообще можно из этого статуса: для экранов и для тестов. */
export function nextStatuses(from: DealStatus): readonly DealStatus[] {
  return NEXT[from]
}

/**
 * Разрешена ли выплата подрядчику.
 *
 * ЕДИНСТВЕННАЯ функция, которая отвечает на этот вопрос, и она отвечает
 * «да» ровно в одном случае. Всё, что связано с деньгами, обязано спрашивать
 * здесь, а не сравнивать статусы у себя: одно место — одно правило (§8).
 *
 * `disputed` не проходит намеренно: из рекламации выплата возможна только
 * после решения оператора, а решение — это переход в `completed`.
 */
export function payoutAllowed(status: DealStatus): boolean {
  return status === 'completed'
}

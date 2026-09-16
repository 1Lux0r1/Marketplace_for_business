import { describe, expect, it } from 'vitest'
import { DEAL_STATUSES } from './schema'
import { FINAL, canMove, nextStatuses, payoutAllowed } from './statuses'
import type { DealStatus } from './types'

/**
 * Переходы статусов сделки — обязательный тест (§8).
 *
 * Здесь проверяется не «работает ли функция», а обещание продукта: деньги
 * не уходят подрядчику раньше подписанного акта. Если этот файл позеленеет
 * на неверной таблице переходов, площадка перестанет быть гарантом, оставшись
 * каталогом, — и узнаем мы об этом на первом споре о деньгах.
 */

const move = (from: DealStatus, to: DealStatus, over: Partial<Parameters<typeof canMove>[0]> = {}) =>
  canMove({ from, to, source: 'catalog', byOperator: false, ...over })

describe('деньги не уходят раньше подписанного акта (§1, §8)', () => {
  /**
   * Главный тест всего модуля. Выплата разрешена ровно в одном статусе,
   * и перебором проверяется, что во всех остальных — нет.
   */
  it('выплата возможна только из «completed», и больше ниоткуда', () => {
    const allowed = DEAL_STATUSES.filter((status) => payoutAllowed(status))
    expect(allowed).toEqual(['completed'])
  })

  /**
   * Из рекламации деньги не уходят сами: сначала решение оператора.
   * Это ровно тот случай, ради которого берётся комиссия.
   */
  it('из спора выплата невозможна, пока его не закрыл оператор', () => {
    expect(payoutAllowed('disputed')).toBe(false)

    // Закрыть спор может только оператор
    expect(move('disputed', 'completed').ok).toBe(false)
    expect(move('disputed', 'completed', { byOperator: true }).ok).toBe(true)
  })

  /**
   * В «completed» ведут ровно два пути: подписанный акт и решение оператора
   * по спору. Любой третий путь — это дыра в обещании площадки.
   */
  it('в «completed» ведут только подписанный акт и решение оператора', () => {
    const ways = DEAL_STATUSES.filter((from) => nextStatuses(from).includes('completed'))
    expect(ways.sort()).toEqual(['act_signed', 'disputed'])
  })

  it('подписанный акт — обязательное условие приёмки, обойти его нечем', () => {
    // Ни из работы, ни из оплаты, ни из выставленного акта в «completed» нельзя
    for (const from of ['in_progress', 'paid', 'act_issued', 'accepted'] as DealStatus[]) {
      expect(move(from, 'completed').ok, `из «${from}» не должно быть пути в completed`).toBe(false)
      expect(move(from, 'completed', { byOperator: true }).ok, `и оператору тоже`).toBe(false)
    }
    expect(move('act_signed', 'completed').ok).toBe(true)
  })
})

describe('два входа сделки', () => {
  /**
   * Перепутать входы — значит дать клиенту зафиксировать цену, которой никто
   * не называл: у сделки из заявки цены в момент создания ещё нет.
   */
  it('из каталога можно сразу к подрядчику, из заявки — только в подбор', () => {
    expect(move('new', 'accepted', { source: 'catalog' }).ok).toBe(true)
    expect(move('new', 'matching', { source: 'catalog' })).toMatchObject({ reason: 'origin' })

    expect(move('new', 'matching', { source: 'request' }).ok).toBe(true)
    expect(move('new', 'accepted', { source: 'request' })).toMatchObject({ reason: 'origin' })
  })

  it('дальше оба пути идут одинаково', () => {
    for (const source of ['catalog', 'request'] as const) {
      expect(move('accepted', 'paid', { source }).ok).toBe(true)
      expect(move('paid', 'in_progress', { source }).ok).toBe(true)
      expect(move('in_progress', 'act_issued', { source }).ok).toBe(true)
      expect(move('act_issued', 'act_signed', { source }).ok).toBe(true)
      expect(move('act_signed', 'completed', { source }).ok).toBe(true)
    }
  })
})

describe('отмена и рекламация', () => {
  /** §8: `disputed` и `cancelled` реализуются вместе с остальными. */
  it('оба статуса существуют и в них есть переходы', () => {
    expect(DEAL_STATUSES).toContain('disputed')
    expect(DEAL_STATUSES).toContain('cancelled')

    const toDispute = DEAL_STATUSES.filter((s) => nextStatuses(s).includes('disputed'))
    expect(toDispute.length).toBeGreaterThan(0)

    const toCancel = DEAL_STATUSES.filter((s) => nextStatuses(s).includes('cancelled'))
    expect(toCancel.length).toBeGreaterThan(0)
  })

  /**
   * Рекламацию можно заявить, когда деньги уже у площадки или работа идёт.
   * Раньше нечего оспаривать, позже сделка уже закрыта.
   */
  it('спор заявляется, пока деньги у площадки или работа не принята', () => {
    for (const from of ['paid', 'in_progress', 'act_issued', 'act_signed'] as DealStatus[]) {
      expect(move(from, 'disputed').ok, `из «${from}» должен быть путь в спор`).toBe(true)
    }
  })

  it('после закрытия сделку не переоткрывают', () => {
    for (const from of ['completed', 'cancelled'] as DealStatus[]) {
      expect(nextStatuses(from)).toEqual([])
      expect(FINAL.has(from)).toBe(true)
    }
  })

  it('отменить можно до начала работ и пока идёт работа, но не после акта', () => {
    expect(move('new', 'cancelled').ok).toBe(true)
    expect(move('accepted', 'cancelled').ok).toBe(true)
    expect(move('in_progress', 'cancelled').ok).toBe(true)
    // Акт подписан — работа принята, отменять уже нечего
    expect(move('act_signed', 'cancelled').ok).toBe(false)
  })
})

describe('таблица переходов замкнута', () => {
  it('у каждого статуса описаны переходы', () => {
    for (const status of DEAL_STATUSES) {
      expect(nextStatuses(status), `нет строки для «${status}»`).toBeDefined()
    }
  })

  it('переходов в несуществующий статус нет', () => {
    const known = new Set<string>(DEAL_STATUSES)
    for (const status of DEAL_STATUSES) {
      for (const next of nextStatuses(status)) {
        expect(known.has(next), `«${status}» ведёт в неизвестный «${next}»`).toBe(true)
      }
    }
  })

  it('в себя переходов нет: это не переход, а сохранение', () => {
    for (const status of DEAL_STATUSES) {
      expect(nextStatuses(status)).not.toContain(status)
    }
  })

  /**
   * Всё, чего нет в таблице, запрещено. Проверяем перебором всех пар:
   * так видно, что разрешённое — это список, а не «всё, кроме».
   */
  it('любая пара вне таблицы запрещена', () => {
    for (const from of DEAL_STATUSES) {
      for (const to of DEAL_STATUSES) {
        const inTable = nextStatuses(from).includes(to)
        const result = canMove({ from, to, source: 'catalog', byOperator: true })
        if (!inTable) {
          expect(result, `«${from}» → «${to}» не в таблице, значит запрещён`).toMatchObject({
            ok: false,
          })
        }
      }
    }
  })
})

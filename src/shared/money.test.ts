import { describe, expect, it } from 'vitest'
import { formatKopecks, commissionKopecks, payoutKopecks } from './money'

/** Денежные расчёты — обязательный тест (§8 CLAUDE.md). */

const NBSP = ' '

describe('formatKopecks', () => {
  it('показывает целые рубли без копеек', () => {
    expect(formatKopecks(540_000n)).toBe(`5${NBSP}400${NBSP}₽`)
  })

  it('показывает копейки, когда они есть', () => {
    expect(formatKopecks(540_050n)).toBe(`5${NBSP}400,50${NBSP}₽`)
  })

  it('ноль — это ноль, а не пусто', () => {
    expect(formatKopecks(0n)).toBe(`0${NBSP}₽`)
  })

  it('отрицательная сумма помечается минусом', () => {
    expect(formatKopecks(-540_000n)).toBe(`−5${NBSP}400${NBSP}₽`)
  })
})

describe('commissionKopecks', () => {
  it('считает долю, а не процент', () => {
    expect(commissionKopecks(540_000n, 0.13)).toBe(70_200n)
  })

  it('округляет вниз — лишней копейки площадка не берёт', () => {
    // 1 копейка × 13 % = 0,13 копейки, площадке достаётся ноль
    expect(commissionKopecks(1n, 0.13)).toBe(0n)
    expect(commissionKopecks(777n, 0.07)).toBe(54n)
  })

  it('сумма всегда сходится: цена = комиссия + выплата', () => {
    for (const price of [0n, 1n, 777n, 540_000n, 999_999_999n]) {
      for (const rate of [0.06, 0.07, 0.13, 0.15]) {
        expect(commissionKopecks(price, rate) + payoutKopecks(price, rate)).toBe(price)
      }
    }
  })

  it('не принимает отрицательную цену и долю вне (0,1)', () => {
    expect(() => commissionKopecks(-1n, 0.13)).toThrow(RangeError)
    expect(() => commissionKopecks(100n, 0)).toThrow(RangeError)
    expect(() => commissionKopecks(100n, 1)).toThrow(RangeError)
    expect(() => commissionKopecks(100n, 13)).toThrow(RangeError)
  })
})

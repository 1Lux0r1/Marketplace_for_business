import { describe, expect, it } from 'vitest'
import { normalizePhone, formatPhone } from './phone'

/** Телефон — способ входа, поэтому один и тот же номер обязан давать одну запись. */

describe('нормализация телефона', () => {
  it('приводит все привычные написания к одному виду', () => {
    const variants = [
      '+7 916 123-45-67',
      '8 916 123 45 67',
      '89161234567',
      '79161234567',
      '9161234567',
      '+7(916)123-45-67',
      ' 8-916-123-45-67 ',
    ]
    for (const input of variants) {
      const result = normalizePhone(input)
      expect(result, input).toEqual({ ok: true, phone: '+79161234567' })
    }
  })

  it('пропускает явно международный номер как есть', () => {
    expect(normalizePhone('+375291234567')).toEqual({ ok: true, phone: '+375291234567' })
  })

  it('отклоняет мусор с понятным текстом', () => {
    for (const input of ['', 'телефон', '123', '8916123456789012345']) {
      const result = normalizePhone(input)
      expect(result.ok, input).toBe(false)
      if (!result.ok) expect(result.error.length).toBeGreaterThan(5)
    }
  })

  it('показывает номер человеку в читаемом виде', () => {
    expect(formatPhone('+79161234567')).toBe('+7 916 123-45-67')
  })

  it('показывает международный номер как есть, а не ломает', () => {
    expect(formatPhone('+375291234567')).toBe('+375291234567')
  })
})

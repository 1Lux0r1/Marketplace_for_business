import { describe, expect, it } from 'vitest'
import { checkInn, normalizeInn } from './inn'

/**
 * Контрольная сумма ИНН. Смысл проверки — развести две разные ситуации:
 * «вы ошиблись в номере» и «такой компании нет». Это разные следующие шаги
 * для человека и разная цена для нас: во втором случае мы дёргаем платный
 * справочник, в первом — незачем.
 */
describe('ИНН', () => {
  it('принимает верный номер организации', () => {
    expect(checkInn('7701234560')).toEqual({ ok: true, inn: '7701234560', kind: 'company' })
  })

  it('принимает верный номер ИП', () => {
    expect(checkInn('770123456703')).toEqual({ ok: true, inn: '770123456703', kind: 'person' })
  })

  it('ловит опечатку в последней цифре', () => {
    // Ровно то, ради чего проверка и нужна: цифра переставлена, номер похож
    const result = checkInn('7701234561')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('опечатка')
  })

  it('ловит переставленные цифры', () => {
    expect(checkInn('7701234506').ok).toBe(false)
  })

  it('объясняет неверную длину, а не просто отказывает', () => {
    const result = checkInn('770123')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('десять')
  })

  it('не пускает буквы', () => {
    const result = checkInn('77012345АБ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('цифр')
  })

  it('терпит пробелы и дефисы из документов', () => {
    expect(normalizeInn('7701 2345-60')).toBe('7701234560')
    expect(checkInn('7701 2345 60').ok).toBe(true)
  })

  it('пустая строка — не ИНН', () => {
    expect(checkInn('').ok).toBe(false)
    expect(checkInn('   ').ok).toBe(false)
  })
})

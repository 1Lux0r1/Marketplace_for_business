import { describe, expect, it } from 'vitest'
import { isValidInn, normalizeInn } from './inn'

/**
 * ИНН попадает в договор, счёт и акт. Опечатка в нём означает документ,
 * который контрагент не проведёт, — поэтому ловим её на входе.
 */

describe('контрольная сумма ИНН', () => {
  it('принимает настоящие номера', () => {
    // Реальные ИНН крупных организаций: проверяем алгоритм, а не эти компании
    for (const inn of ['7707083893', '7728168971', '7710140679']) {
      expect(isValidInn(inn), inn).toBe(true)
    }
  })

  it('отклоняет номер с одной перепутанной цифрой', () => {
    // Самая частая опечатка: цифра набрана мимо
    expect(isValidInn('7707083893')).toBe(true)
    expect(isValidInn('7707083894')).toBe(false)
    expect(isValidInn('7707083993')).toBe(false)
  })

  it('проверяет обе контрольные цифры двенадцатизначного номера', () => {
    expect(isValidInn('500100732259')).toBe(true)
    // Испорчена последняя цифра
    expect(isValidInn('500100732258')).toBe(false)
    // Испорчена предпоследняя
    expect(isValidInn('500100732269')).toBe(false)
  })

  it('не принимает номер неподходящей длины', () => {
    for (const inn of ['', '1', '770708389', '77070838931', '7707083893777']) {
      expect(isValidInn(inn), inn).toBe(false)
    }
  })
})

describe('разбор введённого ИНН', () => {
  it('убирает пробелы, которые люди вставляют всегда', () => {
    expect(normalizeInn(' 7707 0838 93 ')).toEqual({ ok: true, inn: '7707083893' })
  })

  it('говорит понятным текстом, что не так', () => {
    const cases = ['', 'не-инн-вообще', '12345', '7707083894']
    for (const input of cases) {
      const result = normalizeInn(input)
      expect(result.ok, input).toBe(false)
      if (!result.ok) {
        expect(result.error.length, input).toBeGreaterThan(10)
        // Без кодов и без слова «ошибка» (§7.4)
        expect(result.error.toLowerCase(), input).not.toContain('ошибка')
      }
    }
  })

  it('различает номер организации и номер человека', () => {
    // У юрлица номер из 10 цифр, у ИП и физлица — из 12. Перепутать легко,
    // и молча принять чужой вид номера значит выпустить документ не на то лицо
    expect(normalizeInn('7707083893', 'company').ok).toBe(true)
    expect(normalizeInn('500100732259', 'person').ok).toBe(true)

    const personAsCompany = normalizeInn('500100732259', 'company')
    expect(personAsCompany.ok).toBe(false)
    if (!personAsCompany.ok) expect(personAsCompany.error).toContain('10 цифр')

    const companyAsPerson = normalizeInn('7707083893', 'person')
    expect(companyAsPerson.ok).toBe(false)
    if (!companyAsPerson.ok) expect(companyAsPerson.error).toContain('12 цифр')
  })
})

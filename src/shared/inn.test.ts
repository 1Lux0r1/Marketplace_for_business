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

  it('различает номер организации и номер человека, когда вид известен', () => {
    // Юрлицо, вводящее личный ИНН директора: номер верный, но принадлежит
    // человеку. Без этой сверки договор и счёт выпустились бы не на то лицо
    expect(checkInn('7701234560', 'company').ok).toBe(true)
    expect(checkInn('770123456703', 'person').ok).toBe(true)

    const personAsCompany = checkInn('770123456703', 'company')
    expect(personAsCompany.ok).toBe(false)
    if (!personAsCompany.ok) expect(personAsCompany.error).toContain('десяти')

    const companyAsPerson = checkInn('7701234560', 'person')
    expect(companyAsPerson.ok).toBe(false)
    if (!companyAsPerson.ok) expect(companyAsPerson.error).toContain('двенадцати')
  })

  it('на настоящих номерах алгоритм сходится', () => {
    // Реальные ИНН крупных организаций: проверяем алгоритм, а не эти компании
    for (const inn of ['7707083893', '7728168971', '7710140679']) {
      expect(checkInn(inn).ok, inn).toBe(true)
    }
    // Классический пример двенадцатизначного из методики
    expect(checkInn('500100732259').ok).toBe(true)
  })

  it('тексты написаны для человека (§7.4)', () => {
    for (const input of ['', 'не-инн-вообще', '12345', '7701234561']) {
      const result = checkInn(input)
      expect(result.ok, input).toBe(false)
      if (!result.ok) {
        expect(result.error.length, input).toBeGreaterThan(10)
        expect(result.error.toLowerCase(), input).not.toContain('ошибка')
      }
    }
  })
})

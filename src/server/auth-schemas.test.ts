import { describe, expect, it } from 'vitest'
import { loginSchema, registerSchema } from './auth-schemas'

/**
 * Схема формы регистрации.
 *
 * Здесь ломалась регистрация физлица: форма не показывает ни ИНН, ни название,
 * а схема требовала название — и человек получал «Укажите название» про поле,
 * которого нет на экране. Одна из трёх форм собственности не работала вовсе.
 */

const person = {
  legalForm: 'individual' as const,
  fullName: 'Анна Ковалёва',
  email: 'anna@example.ru',
  phone: '+79161234567',
  password: 'корова лошадь батарейка',
}

const company = {
  ...person,
  legalForm: 'company' as const,
  companyName: 'Кофейня «Пример»',
  inn: '7701234560',
  position: 'Директор',
}

/** Первая жалоба схемы: текст и поле, к которому она относится. */
function complaint(input: unknown): { message: string; field: string } | null {
  const parsed = registerSchema.safeParse(input)
  if (parsed.success) return null
  const issue = parsed.error.issues[0]!
  return { message: issue.message, field: String(issue.path[0] ?? '') }
}

describe('регистрация физлица', () => {
  it('проходит без ИНН и без названия — этих полей у него на экране нет', () => {
    expect(complaint(person)).toBeNull()
  })

  it('проходит и когда форма прислала пустые строки вместо отсутствующих полей', () => {
    // Подстраховка на случай, если форма снова начнёт слать пустые поля
    expect(complaint({ ...person, position: '' })).toBeNull()
  })
})

describe('регистрация ИП и юрлица', () => {
  it('проходит с названием и ИНН', () => {
    expect(complaint(company)).toBeNull()
  })

  it('без названия жалуется именно на название', () => {
    const problem = complaint({ ...company, companyName: '' })
    expect(problem?.field).toBe('companyName')
  })

  it('без ИНН жалуется именно на ИНН', () => {
    // Поле в форме обязательное, но проверка в форме — удобство, а не защита (§6)
    const problem = complaint({ ...company, inn: '' })
    expect(problem?.field).toBe('inn')
    expect(problem?.message).toContain('ИНН')
  })
})

describe('пределы длины', () => {
  it('не пускает в базу имя и название любой длины', () => {
    expect(complaint({ ...company, fullName: 'А'.repeat(5000) })?.field).toBe('fullName')
    expect(complaint({ ...company, companyName: 'Б'.repeat(5000) })?.field).toBe('companyName')
    expect(complaint({ ...company, position: 'В'.repeat(5000) })?.field).toBe('position')
  })

  it('не даёт прислать пароль в сто тысяч символов', () => {
    // Проверка пароля — намеренно медленная операция, и объём для неё
    // выбирает тот, кто жмёт кнопку
    expect(complaint({ ...company, password: 'я'.repeat(100_000) })?.field).toBe('password')
    expect(loginSchema.safeParse({
      login: 'anna@example.ru',
      password: 'я'.repeat(100_000),
      remember: false,
    }).success).toBe(false)
  })
})

describe('тексты для человека', () => {
  it('без кодов, без слова «ошибка» и без английского (§7.4)', () => {
    const cases = [
      { ...company, companyName: '' },
      { ...company, inn: '' },
      { ...person, fullName: 'А' },
      { ...person, email: 'не-почта' },
      { ...person, phone: '' },
    ]
    for (const input of cases) {
      const problem = complaint(input)
      expect(problem, JSON.stringify(input.legalForm)).not.toBeNull()
      expect(problem!.message.length).toBeGreaterThan(5)
      expect(problem!.message.toLowerCase()).not.toContain('ошибка')
      expect(problem!.message).not.toMatch(/[A-Za-z]{4,}/u)
    }
  })
})

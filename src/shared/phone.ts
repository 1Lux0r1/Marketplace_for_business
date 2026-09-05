/**
 * Телефон хранится в E.164: `+79161234567` (docs/04-glossary.md).
 *
 * Телефон — способ входа, значит он должен приводиться к одному виду всегда.
 * Иначе «8 916 123-45-67» и «+7 916 123 45 67» окажутся разными людьми,
 * а проверка уникальности перестанет работать.
 *
 * Своя нормализация вместо библиотеки разбора телефонов всего мира: нам нужна
 * Россия и пропуск явно международных номеров, это тридцать строк (§3).
 */

export type PhoneResult = { ok: true; phone: string } | { ok: false; error: string }

export function normalizePhone(input: string): PhoneResult {
  const raw = input.trim()
  if (raw === '') return { ok: false, error: 'Укажите телефон' }

  const explicitlyInternational = raw.startsWith('+')
  const digits = raw.replace(/\D/gu, '')

  if (digits.length === 0) return { ok: false, error: 'В номере нет ни одной цифры' }

  // Явно международный номер оставляем как есть: не нам решать,
  // что правильно для чужой страны
  if (explicitlyInternational && !digits.startsWith('7')) {
    if (digits.length < 8 || digits.length > 15) {
      return { ok: false, error: 'Номер должен содержать от 8 до 15 цифр' }
    }
    return { ok: true, phone: `+${digits}` }
  }

  // Российский номер в трёх привычных видах: 8XXXXXXXXXX, 7XXXXXXXXXX, XXXXXXXXXX
  let national: string
  if (digits.length === 11 && (digits.startsWith('8') || digits.startsWith('7'))) {
    national = digits.slice(1)
  } else if (digits.length === 10) {
    national = digits
  } else {
    return {
      ok: false,
      error: 'Не похоже на номер телефона. Пример: +7 916 123-45-67',
    }
  }

  if (!/^9\d{9}$/u.test(national) && !/^[3-8]\d{9}$/u.test(national)) {
    return { ok: false, error: 'Не похоже на российский номер. Пример: +7 916 123-45-67' }
  }

  return { ok: true, phone: `+7${national}` }
}

/** Для показа человеку: +7 916 123-45-67. */
export function formatPhone(phone: string): string {
  const m = /^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/u.exec(phone)
  if (!m) return phone
  return `+7 ${m[1]} ${m[2]}-${m[3]}-${m[4]}`
}

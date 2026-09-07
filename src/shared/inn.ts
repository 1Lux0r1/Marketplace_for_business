/**
 * ИНН: нормализация и проверка контрольной суммы.
 *
 * Контрольная сумма — часть самого номера, поэтому опечатку видно сразу,
 * не спрашивая справочник. Это важно по двум причинам: справочник платный
 * и его дёргать за каждую опечатку незачем, а человеку нужно сказать
 * «проверьте номер», а не «компания не найдена» — это разные вещи и разные
 * следующие шаги.
 *
 * Алгоритм — не наша выдумка: он задан порядком присвоения ИНН и одинаков
 * у всех. Десять цифр у организаций, двенадцать у ИП и физлиц.
 */

const WEIGHTS_10 = [2, 4, 10, 3, 5, 9, 4, 6, 8] as const
const WEIGHTS_12_FIRST = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8] as const
const WEIGHTS_12_SECOND = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8] as const

export type InnCheck =
  | { ok: true; inn: string; kind: 'company' | 'person' }
  | { ok: false; error: string }

/** Убрать пробелы и дефисы: люди вставляют ИНН из документов как есть. */
export function normalizeInn(input: string): string {
  return input.replace(/[\s-]/gu, '')
}

export function checkInn(input: string): InnCheck {
  const inn = normalizeInn(input)

  if (!/^\d+$/u.test(inn)) {
    return { ok: false, error: 'ИНН состоит только из цифр' }
  }
  if (inn.length !== 10 && inn.length !== 12) {
    return {
      ok: false,
      error: 'В ИНН десять цифр у организации и двенадцать у ИП. Проверьте номер.',
    }
  }

  const digits = [...inn].map(Number)
  const wrong = { ok: false as const, error: 'Похоже, в ИНН опечатка: номер не сходится' }

  if (inn.length === 10) {
    return checkDigit(digits, WEIGHTS_10) === digits[9]
      ? { ok: true, inn, kind: 'company' }
      : wrong
  }

  const eleventh = checkDigit(digits, WEIGHTS_12_FIRST)
  const twelfth = checkDigit(digits, WEIGHTS_12_SECOND)
  return eleventh === digits[10] && twelfth === digits[11]
    ? { ok: true, inn, kind: 'person' }
    : wrong
}

function checkDigit(digits: number[], weights: readonly number[]): number {
  const sum = weights.reduce((total, weight, index) => total + weight * (digits[index] ?? 0), 0)
  return (sum % 11) % 10
}

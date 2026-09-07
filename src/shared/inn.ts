/**
 * ИНН: приведение к одному виду и проверка контрольной суммы.
 *
 * Контрольная сумма — не придирка, а единственный способ поймать опечатку
 * до того, как она попадёт в договор и счёт. Там неверный ИНН стоит дорого:
 * счёт с чужим номером покупатель не проведёт, а исправлять придётся
 * перевыпуском документов.
 *
 * Это проверка формата, а не существования компании. Номер может быть
 * правильно устроен и при этом не принадлежать никому — сверка с реальным
 * реестром идёт отдельно, через справочник (задача 02-2).
 *
 * Алгоритм — государственный, из приказа о порядке присвоения ИНН: цифры
 * умножаются на фиксированные веса, сумма по модулю 11 и потом 10 даёт
 * контрольную цифру. У организации номер из 10 цифр с одной контрольной,
 * у человека и ИП — из 12 с двумя.
 */

export type InnResult = { ok: true; inn: string } | { ok: false; error: string }

/** Кому принадлежит номер: организации — 10 цифр, человеку и ИП — 12. */
export type InnKind = 'company' | 'person'

const WEIGHTS_10 = [2, 4, 10, 3, 5, 9, 4, 6, 8]
const WEIGHTS_11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8]
const WEIGHTS_12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]

function controlDigit(digits: number[], weights: number[]): number {
  let sum = 0
  for (let i = 0; i < weights.length; i += 1) sum += weights[i]! * digits[i]!
  return (sum % 11) % 10
}

/** Правильно ли устроен номер — без учёта того, кому он должен принадлежать. */
export function isValidInn(inn: string): boolean {
  if (!/^\d{10}$|^\d{12}$/u.test(inn)) return false
  const digits = [...inn].map(Number)

  if (digits.length === 10) return controlDigit(digits, WEIGHTS_10) === digits[9]
  return (
    controlDigit(digits, WEIGHTS_11) === digits[10] &&
    controlDigit(digits, WEIGHTS_12) === digits[11]
  )
}

/**
 * Привести введённое к виду для хранения и сказать понятным текстом,
 * что не так. Пробелы люди вставляют всегда — их убираем молча.
 */
export function normalizeInn(input: string, kind?: InnKind): InnResult {
  const digits = input.replace(/\s/gu, '').trim()

  if (digits === '') return { ok: false, error: 'Укажите ИНН' }
  if (!/^\d+$/u.test(digits)) return { ok: false, error: 'В ИНН только цифры, без пробелов и знаков' }

  if (digits.length !== 10 && digits.length !== 12) {
    return {
      ok: false,
      error: 'В ИНН 10 цифр у организации и 12 у ИП или физлица. Проверьте, сколько ввели.',
    }
  }

  if (kind === 'company' && digits.length !== 10) {
    return { ok: false, error: 'У организации ИНН из 10 цифр. Похоже, это ИНН человека.' }
  }
  if (kind === 'person' && digits.length !== 12) {
    return { ok: false, error: 'У ИП и физлица ИНН из 12 цифр. Похоже, это ИНН организации.' }
  }

  if (!isValidInn(digits)) {
    return { ok: false, error: 'ИНН не сходится по контрольной цифре — проверьте, нет ли опечатки' }
  }

  return { ok: true, inn: digits }
}

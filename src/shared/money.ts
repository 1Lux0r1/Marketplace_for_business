/**
 * Деньги — всегда `bigint` в копейках, имя поля заканчивается на `Kopecks` (§6).
 * Здесь только форматирование для показа; ни одного `number` для сумм.
 */

const rub = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
const rubWithKopecks = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** «5 400 ₽», а с копейками — «5 400,50 ₽». Копейки показываем только когда они есть. */
export function formatKopecks(kopecks: bigint): string {
  const negative = kopecks < 0n
  const abs = negative ? -kopecks : kopecks
  const whole = abs / 100n
  const rest = abs % 100n

  const body =
    rest === 0n
      ? rub.format(whole)
      : rubWithKopecks.format(Number(whole) + Number(rest) / 100)

  // Неразрывный пробел перед знаком рубля: иначе «₽» переносится на новую строку один
  return `${negative ? '−' : ''}${body}\u00A0₽`
}

/**
 * Комиссия площадки. Доля хранится как 0.13, не как 13 (docs/04-glossary.md).
 * Округление вниз — в пользу подрядчика: площадка не берёт лишней копейки.
 */
export function commissionKopecks(priceKopecks: bigint, rate: number): bigint {
  if (priceKopecks < 0n) throw new RangeError('Цена не может быть отрицательной')
  if (!(rate > 0 && rate < 1)) throw new RangeError('Доля комиссии должна быть между 0 и 1')

  // Считаем в целых: доля переводится в базисные пункты, чтобы не ловить float
  const basisPoints = BigInt(Math.round(rate * 10_000))
  return (priceKopecks * basisPoints) / 10_000n
}

/** Сколько уходит подрядчику: цена минус комиссия. Сумма всегда сходится. */
export function payoutKopecks(priceKopecks: bigint, rate: number): bigint {
  return priceKopecks - commissionKopecks(priceKopecks, rate)
}

/**
 * Разбор того, что человек напечатал, в копейки.
 *
 * Живёт здесь, а не в поле ввода: это денежный расчёт, и §8 требует покрыть
 * его тестами наравне с комиссией. Ошибка тут дороже любой другой в форме —
 * лишний ноль в цене карточки уходит в каталог и в счёт.
 *
 * Принимаем то, что люди действительно печатают: пробелы любых видов внутри
 * числа, запятую и точку как разделитель копеек. Не принимаем всё остальное —
 * молча «понять» кривой ввод хуже, чем сказать, что не поняли.
 *
 * @returns копейки, или `null` если поле пустое, или `undefined` если разобрать нельзя
 */
export function parseRublesToKopecks(input: string): bigint | null | undefined {
  // \u00A0 неразрывный и \u202F узкий неразрывный приходят из вставки
  // скопированной суммы: «5 400 ₽» из письма или из счёта
  const cleaned = input.replace(/[\s\u00A0\u202F]/g, '').replace(',', '.')
  if (cleaned === '') return null

  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned)
  if (!match) return undefined

  const rubles = BigInt(match[1]!)
  // «5.5» — это пятьдесят копеек, а не пять: дописываем разряд до сотых
  const kopecks = BigInt((match[2] ?? '0').padEnd(2, '0'))
  return rubles * 100n + kopecks
}

/** Копейки → строка для поля ввода: «5400» или «5400,50». Без знака рубля и пробелов. */
export function kopecksToInput(kopecks: bigint | null): string {
  if (kopecks === null) return ''
  const whole = kopecks / 100n
  const rest = kopecks % 100n
  return rest === 0n ? String(whole) : `${whole},${String(rest).padStart(2, '0')}`
}

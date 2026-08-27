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

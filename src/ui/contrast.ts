/**
 * Контраст цвета к цвету по WCAG 2.1. Двадцать строк вместо зависимости (§3).
 *
 * Нужно, чтобы порог §7.6 был проверкой, а не пожеланием: значения токенов
 * меняются при смене брендинга (Q6), и без счёта контраста «затемнённый вариант
 * для текста» подбирается на глаз и однажды подбирается неверно.
 */

/** #rrggbb → [r, g, b], 0..255. Другие формы записи не принимаем: в токенах их нет. */
export function parseHex(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) throw new TypeError(`Ожидался цвет вида #rrggbb, получен «${hex}»`)
  const n = Number.parseInt(m[1]!, 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

/** Относительная яркость по WCAG: sRGB спрямляется, каналы складываются с весами. */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Отношение контраста: от 1 (одинаковые) до 21 (чёрный к белому). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** Тон в градусах и насыщенность в процентах — ими разводятся роли цвета (§7.2). */
export function hueAndSaturation(hex: string): { hue: number; saturation: number } {
  const [r, g, b] = parseHex(hex).map((v) => v / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const span = max - min
  const lightness = (max + min) / 2

  if (span === 0) return { hue: 0, saturation: 0 }

  const sixth = max === r ? ((g - b) / span) % 6 : max === g ? (b - r) / span + 2 : (r - g) / span + 4
  const hue = (sixth * 60 + 360) % 360
  return { hue, saturation: (span / (1 - Math.abs(2 * lightness - 1))) * 100 }
}

/** Кратчайшее расстояние между тонами по цветовому кругу: 350° и 10° различаются на 20°. */
export function hueDistance(a: string, b: string): number {
  const d = Math.abs(hueAndSaturation(a).hue - hueAndSaturation(b).hue) % 360
  return d > 180 ? 360 - d : d
}

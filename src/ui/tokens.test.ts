import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { contrast, hueDistance, hueAndSaturation } from './contrast'

/**
 * Светлая и тёмная темы проектируются вместе: каждый токен определён в обеих,
 * цвет, заданный только внутри @media (prefers-color-scheme: dark), — ошибка (§7.2).
 *
 * Тёмных блока два — по классу .dark и по системной настройке. Тест держит
 * все три набора имён в синхроне: без него они разъедутся на третьем спринте.
 */
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')

function bodyOf(header: string): string {
  const start = css.indexOf(header)
  if (start === -1) throw new Error(`Блок ${header} не найден в globals.css`)
  const open = css.indexOf('{', start)
  return css.slice(open, css.indexOf('\n}', open))
}

function tokensOf(header: string): string[] {
  return [...bodyOf(header).matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]!).sort()
}

/** Значения токенов темы: имя → #rrggbb. Нецветные токены сюда не попадают. */
function paletteOf(header: string): Record<string, string> {
  const palette: Record<string, string> = {}
  for (const m of bodyOf(header).matchAll(/^\s*(--[a-z0-9-]+):\s*(#[0-9a-f]{6});/gim)) {
    palette[m[1]!] = m[2]!
  }
  return palette
}

describe('токены темы', () => {
  const light = tokensOf(':root {')
  const darkByClass = tokensOf('.dark {')
  const darkByPreference = tokensOf(':root:not(.light) {')

  it('светлая тема определяет непустой набор токенов', () => {
    expect(light.length).toBeGreaterThan(20)
  })

  it('тёмная тема по классу определяет ровно те же токены', () => {
    expect(darkByClass).toEqual(light)
  })

  it('тёмная тема по системной настройке определяет ровно те же токены', () => {
    expect(darkByPreference).toEqual(light)
  })

  it('каждый токен темы прокинут в токены Tailwind', () => {
    const exposed = new Set(
      [...css.matchAll(/--color-[a-z0-9-]+:\s*var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]!),
    )
    const missing = light.filter((name) => !exposed.has(name))
    expect(missing, `не прокинуты в @theme: ${missing.join(', ')}`).toEqual([])
  })
})

/**
 * Порог §7.6 не обсуждается, поэтому он проверяется, а не подразумевается.
 *
 * Пары ниже — не абстрактный список, а те сочетания «текст на подложке»,
 * которые реально стоят в компонентах. Когда появится брендинг (Q6) и цвета
 * поменяются, этот тест покажет, какая пара перестала читаться, — до того,
 * как это увидит клиент.
 */
const readablePairs: Array<[string, string, string]> = [
  ['основной текст на фоне страницы', '--text-1', '--bg'],
  ['второй уровень текста на фоне', '--text-2', '--bg'],
  ['третий уровень текста на фоне', '--text-3', '--bg'],
  ['подпись на тихой поверхности', '--text-3', '--surface-2'],
  ['подпись на поверхности 3', '--text-3', '--surface-3'],
  ['текст на бирюзовой кнопке', '--on-accent', '--accent'],
  ['ссылка на фоне страницы', '--accent-strong', '--bg'],
  ['текст на бирюзовой подложке', '--accent-strong', '--accent-tint'],
  ['текст на теге выгоды', '--on-promo', '--promo'],
  ['текст выгоды на подложке', '--promo-strong', '--promo-tint'],
  ['бейдж «успешно»', '--ok-strong', '--ok-tint'],
  ['бейдж «нужно действие»', '--warn-strong', '--warn-tint'],
  ['бейдж «проблема»', '--err-strong', '--err-tint'],
  ['нейтральный бейдж', '--neutral-strong', '--neutral-tint'],
  ['текст ошибки под полем', '--err-strong', '--bg'],
]

/** Иконки и точки статуса — крупные элементы, им хватает 3:1 (§7.6). */
const iconPairs: Array<[string, string, string]> = [
  ['точка бейджа «успешно»', '--ok', '--ok-tint'],
  ['точка бейджа «нужно действие»', '--warn', '--warn-tint'],
  ['точка бейджа «проблема»', '--err', '--err-tint'],
  ['точка нейтрального бейджа', '--neutral', '--neutral-tint'],
  ['кольцо фокуса на фоне', '--accent-strong', '--bg'],
]

describe.each([
  ['светлая', ':root {'],
  ['тёмная', '.dark {'],
])('контраст, %s тема (§7.6)', (_name, header) => {
  const palette = paletteOf(header)

  it.each(readablePairs)('%s — не ниже 4,5:1', (_label, fg, bg) => {
    expect(contrast(palette[fg]!, palette[bg]!)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(iconPairs)('%s — не ниже 3:1', (_label, fg, bg) => {
    expect(contrast(palette[fg]!, palette[bg]!)).toBeGreaterThanOrEqual(3)
  })
})

/**
 * Роли цвета не должны сливаться (§7.2). Проверяем ровно то, что там названо:
 * выгода — не статус, ожидание — не проблема, а акцент не путается ни с чем.
 *
 * Разводить положено тремя способами сразу. Подача (заливка против подложки)
 * и обязательный текст держатся кодом компонентов: `PromoTag` умеет только
 * заливку, `StatusBadge` только подложку, и оба требуют текст. Третий способ —
 * насыщенность и тон — держится здесь.
 */
describe.each([
  ['светлая', ':root {'],
  ['тёмная', '.dark {'],
])('роли цвета, %s тема (§7.2)', (_name, header) => {
  const palette = paletteOf(header)

  it('подложка выгоды и подложка «нужно действие» — разные цвета', () => {
    expect(palette['--promo-tint']).not.toBe(palette['--warn-tint'])
  })

  it('выгода насыщеннее, чем ожидание: их не спутать на одном экране', () => {
    const promo = hueAndSaturation(palette['--promo-tint']!)
    const warn = hueAndSaturation(palette['--warn-tint']!)
    expect(promo.saturation - warn.saturation).toBeGreaterThanOrEqual(15)
  })

  it('выгода и проблема расходятся по тону не меньше чем на 15°', () => {
    expect(hueDistance(palette['--promo']!, palette['--err']!)).toBeGreaterThanOrEqual(15)
  })

  it('ожидание и проблема расходятся по тону не меньше чем на 15°', () => {
    expect(hueDistance(palette['--warn']!, palette['--err']!)).toBeGreaterThanOrEqual(15)
  })

  it('акцент не совпадает ни с одним статусным цветом', () => {
    for (const status of ['--ok', '--warn', '--err', '--promo'] as const) {
      expect(hueDistance(palette['--accent']!, palette[status]!)).toBeGreaterThan(30)
    }
  })
})

/**
 * Одна типографическая шкала на весь проект, размеры только из неё (§7.3).
 *
 * Значения закреплены цифрами намеренно. Шкала уже разъезжалась: заголовок
 * страницы стоял 28 px в коде против 26 px в утверждённом макете, и заметить
 * это можно было только приложив линейку к экрану. Если шкала меняется —
 * меняется и артборд design/Tokens.dc.html, одним решением, а не по факту.
 */
describe('типографическая шкала (§7.3)', () => {
  const scale = { label: 11, caption: 12, table: 13, body: 14, lead: 16, section: 20, page: 26, display: 34 }

  it.each(Object.entries(scale))('%s — %i px, как в макете', (name, px) => {
    const found = new RegExp(`--text-${name}:\\s*([\\d.]+)rem;`).exec(css)
    expect(found, `токен --text-${name} не найден`).not.toBeNull()
    expect(Number(found![1]) * 16).toBe(px)
  })

  it('шкала растёт без повторов: два размера с одним значением — ошибка', () => {
    const sizes = Object.values(scale)
    expect(new Set(sizes).size).toBe(sizes.length)
    expect([...sizes].sort((a, b) => a - b)).toEqual(sizes)
  })

  it('размеров ровно столько, сколько в шкале: лишний токен обходит её', () => {
    const declared = [...css.matchAll(/--text-([a-z]+):\s*[\d.]+rem;/g)].map((m) => m[1]!)
    expect(declared.sort()).toEqual(Object.keys(scale).sort())
  })
})

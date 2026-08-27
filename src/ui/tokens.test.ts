import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Светлая и тёмная темы проектируются вместе: каждый токен определён в обеих,
 * цвет, заданный только внутри @media (prefers-color-scheme: dark), — ошибка (§7.2).
 *
 * Тёмных блока два — по классу .dark и по системной настройке. Тест держит
 * все три набора имён в синхроне: без него они разъедутся на третьем спринте.
 */
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')

function tokensOf(header: string): string[] {
  const start = css.indexOf(header)
  if (start === -1) throw new Error(`Блок ${header} не найден в globals.css`)
  const open = css.indexOf('{', start)
  const end = css.indexOf('\n}', open)
  const body = css.slice(open, end)
  return [...body.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]!).sort()
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

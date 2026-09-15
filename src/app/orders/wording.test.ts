import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * §7.1: системные термины не протекают в интерфейс, и «Заявки» названы там
 * прямо среди того, чего клиент не видит никогда.
 *
 * Для владельца кофейни заявка и заказ — одно и то же желание «чтобы мне
 * сделали работу». Два слова заставляют его думать про нашу кухню и гадать,
 * чем одно отличается от другого. Поэтому в коде и у оператора «заявка»,
 * а на экране у клиента — «задача» и «заказ».
 *
 * Правило, которое нельзя проверить, при двух агентах не работает (§12).
 * Здесь оно проверяется.
 */
const SCREENS = join(import.meta.dirname)

/** Только то, что видит человек: строки в кавычках и текст между тегами. */
function visibleText(code: string): string {
  const withoutComments = code.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '')
  return withoutComments
}

describe('язык экрана клиента (§7.1)', () => {
  const files = readdirSync(SCREENS).filter((f) => f.endsWith('.tsx'))

  it.each(files)('%s не показывает клиенту слово «заявка»', (file) => {
    const code = visibleText(readFileSync(join(SCREENS, file), 'utf8'))
    const leaked = [...code.matchAll(/.{0,40}[Зз]аявк\w*.{0,40}/gu)].map((m) => m[0].trim())

    expect(leaked, `«заявка» на экране клиента — это наше слово, не его`).toEqual([])
  })

  it('тест смотрит туда, где есть что проверять', () => {
    expect(files.length).toBeGreaterThan(0)
  })
})

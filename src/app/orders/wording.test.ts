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

/**
 * Экраны подрядчика — та же история: §7.1 запрещает ему «Листинги»,
 * «Матчинг» и «Офферы», а «Сделки» — системное слово для обоих.
 */
const OTHER_SCREENS = [
  join(import.meta.dirname, '..', 'works'),
  join(import.meta.dirname, '..', '(storefront)'),
]

/** Только то, что видит человек: строки в кавычках и текст между тегами. */
function visibleText(code: string): string {
  const withoutComments = code.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '')
  return withoutComments
}

describe('язык экрана клиента (§7.1)', () => {
  const files = readdirSync(SCREENS).filter((f) => f.endsWith('.tsx'))

  it.each(files)('%s не показывает клиенту слово «заявка»', (file) => {
    const code = visibleText(readFileSync(join(SCREENS, file), 'utf8'))
    const leaked = [...code.matchAll(/.{0,40}заявк\p{L}*.{0,40}/giu)].map((m) => m[0].trim())

    expect(leaked, `«заявка» на экране клиента — это наше слово, не его`).toEqual([])
  })

  it('тест смотрит туда, где есть что проверять', () => {
    expect(files.length).toBeGreaterThan(0)
  })
})

describe('«сделка» — слово оператора, не клиента (§7.1)', () => {
  const screens = [
    ...readdirSync(SCREENS).filter((f) => f.endsWith('.tsx')).map((f) => join(SCREENS, f)),
    ...OTHER_SCREENS.flatMap((dir) =>
      readdirSync(dir).filter((f) => f.endsWith('.tsx')).map((f) => join(dir, f)),
    ),
  ]

  /**
   * Запрещено не само слово, а слово КАК НАЗВАНИЕ ЕГО ВЕЩИ: «мои сделки»,
   * «ваша сделка», «Сделка №1240». Это и есть системный термин, протёкший
   * в интерфейс.
   *
   * «Сделку ведём мы» и «как защищена сделка» — обычный деловой русский
   * и прямая цитата обещания из §1. Запрещать их значило бы запретить
   * говорить о том, что мы продаём.
   */
  // `\w` в JavaScript — латиница: по кириллице он не работает вовсе,
  // и правило, написанное через него, молча пропускает всё
  const asLabel =
    /(?:мо[иё]|ваш\p{L}*|эт[ао]|сво\p{L}+)\s+сделк\p{L}*|сделк\p{L}*\s*№|сделка\s*:/iu

  it.each(screens)('%s не называет заказ человека «сделкой»', (file) => {
    const code = visibleText(readFileSync(file, 'utf8'))
    const leaked = [...code.matchAll(/.{0,40}сделк\p{L}*.{0,40}/giu)]
      .map((m) => m[0].trim())
      .filter((hit) => asLabel.test(hit))

    expect(leaked, '«сделка» как название заказа клиента или подрядчика').toEqual([])
  })
})

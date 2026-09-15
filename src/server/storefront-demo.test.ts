import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { isAvailable, storefront, storefrontCard } from './storefront-queries.demo'

/**
 * Витрина демо на GitHub Pages.
 *
 * Демо — это то, на чём площадку показывают, и у него два требования,
 * которые легко нарушить молча: там должно быть что показать, и там нельзя
 * выдавать выдуманные цифры за настоящие (§9.7).
 *
 * Первое ломается тихо: витрина остаётся пустой, сборка зелёная, и это
 * видно только глазами. Второе ломается ещё тише.
 */

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('в демо есть что показать', () => {
  it('живой базы за витриной нет, и витрина об этом знает', () => {
    expect(isAvailable()).toBe(false)
  })

  it('карточки всё равно есть: пустая витрина — это не демонстрация', async () => {
    const page = await storefront({})
    expect(page.items.length).toBeGreaterThan(0)
    expect(page.total).toBe(page.items.length)
    expect(page.categories.length).toBeGreaterThan(0)
  })

  it('верх ползунка цены — самая дорогая карточка, а не круглое число', async () => {
    const page = await storefront({})
    const dearest = page.items.reduce((max, i) => (i.priceKopecks > max ? i.priceKopecks : max), 0n)
    expect(page.priceCeilingKopecks).toBe(dearest)
  })

  it('приостановленный подрядчик в каталог не попадает, как и в базе', async () => {
    const page = await storefront({})
    expect(page.items.map((i) => i.contractorName)).not.toContain('Демо-Снабжение')
  })
})

describe('демо ничего не выдаёт за настоящее', () => {
  it('ни одна демо-компания не помечена проверенной', async () => {
    const page = await storefront({})
    expect(page.items.filter((i) => i.innVerified)).toEqual([])
  })

  it('названия компаний начинаются с «Демо-»', async () => {
    const page = await storefront({})
    const wrong = page.items.map((i) => i.contractorName).filter((n) => !n.startsWith('Демо-'))
    expect(wrong).toEqual([])
  })

  it('на витрине демо стоит предупреждение, и на карточке услуги тоже', () => {
    const screen = read('app/(storefront)/demo-storefront.tsx')
    // Дважды: на витрине и на карточке, куда попадают по прямой ссылке
    expect(screen.match(/<DemoDataNotice \/>/g)).toHaveLength(2)
  })
})

describe('отбор в демо повторяет правила живой витрины', () => {
  it('поиск не различает регистр и ищет по описанию тоже', async () => {
    const byTitle = await storefront({ query: 'УБОРКА' })
    expect(byTitle.items.length).toBeGreaterThan(0)
    expect(byTitle.items.every((i) => /уборка/i.test(`${i.title} ${i.description ?? ''}`))).toBe(true)
  })

  it('потолок цены включает саму границу', async () => {
    const all = await storefront({})
    const cheapest = all.items.reduce((min, i) => (i.priceKopecks < min ? i.priceKopecks : min), all.items[0]!.priceKopecks)
    const page = await storefront({ priceToKopecks: cheapest })
    expect(page.items.length).toBeGreaterThan(0)
    expect(page.items.every((i) => i.priceKopecks <= cheapest)).toBe(true)
  })

  it('округ находит и тех, кто выезжает по всей Москве', async () => {
    const page = await storefront({ zoneCode: 'msk-cao' })
    expect(page.items.some((i) => i.zones.includes('msk'))).toBe(true)
  })

  it('категория отбирает свои карточки', async () => {
    const page = await storefront({ categoryId: 'cleaning' })
    expect(page.items.length).toBeGreaterThan(0)
    expect(page.items.every((i) => i.categoryCode === 'cleaning')).toBe(true)
  })

  it('карточка открывается по своему номеру, чужой номер — пусто', async () => {
    const page = await storefront({})
    const first = page.items[0]!
    expect((await storefrontCard(first.id))?.title).toBe(first.title)
    expect(await storefrontCard('такого-нет')).toBeNull()
  })

  it('округа выезда — названиями, а не кодами (§7.1)', async () => {
    const page = await storefront({})
    const names = page.items.flatMap((i) => i.zoneNames)
    expect(names.length).toBeGreaterThan(0)
    expect(names.filter((name) => /[a-z]/i.test(name))).toEqual([])
  })
})

describe('данные демо не продублированы', () => {
  it('цены живут в одном файле: сид их не хранит, а читает', () => {
    const seed = read('db/seed.ts')
    expect(seed).not.toMatch(/rubles:/)
    expect(seed).toContain("from './demo-catalogue'")
  })
})

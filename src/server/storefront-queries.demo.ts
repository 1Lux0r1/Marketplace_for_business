/**
 * Витрина для демо на GitHub Pages: базы там нет, и карточки собираются
 * из того же файла, которым засевается база для разработки.
 *
 * Раньше витрина в демо была пустой. Пока каталог жил по отдельной ссылке,
 * это было терпимо; теперь витрина — главная, и демо открывалось объяснением
 * «здесь могли бы быть услуги». Демо существует, чтобы продукт можно было
 * показать, а показать пустой экран нельзя.
 *
 * Цены и компании здесь ВЫДУМАНЫ — ровно те же, что в `db/demo-catalogue.ts`,
 * и ни одной новой. Поэтому витрина демо говорит об этом прямо, отдельной
 * полосой над карточками: человек, которому показывают площадку, не должен
 * принять эти цифры за рынок (§9.7).
 *
 * Подменяется на сборке, см. `next.config.ts`.
 */
import * as catalog from '@/modules/catalog'
import { CATEGORIES, CONTRACTORS, LISTINGS } from '@/db/demo-catalogue'
import { zoneNames } from './zone-names'
import type { StorefrontCard, StorefrontPage } from './storefront-queries'

export type { StorefrontCard, StorefrontPage }

/**
 * Живой базы за витриной нет. Витрина при этом не пустая: экран сам решает,
 * что с этим делать — здесь он показывает полосу «данные демонстрационные».
 */
export function isAvailable(): boolean {
  return false
}

/** Код категории заменяет идентификатор: своей базы у демо нет. */
const categories: catalog.Category[] = CATEGORIES.map((category) => ({
  id: category.code,
  code: category.code,
  name: category.name,
  kind: category.kind,
  isActive: true,
  sortOrder: category.sortOrder,
}))

const categoryByCode = new Map(categories.map((category) => [category.code, category]))

/**
 * Карточки в том же виде, в каком их отдаёт живая витрина.
 *
 * Подрядчики со статусом не `active` пропущены — так же, как их отсекает
 * запрос в базе: приостановленная компания не показывается в каталоге.
 */
const cards: StorefrontCard[] = CONTRACTORS.filter(
  (contractor) => (contractor.status ?? 'active') === 'active',
).flatMap((contractor) =>
  (LISTINGS[contractor.name] ?? []).map((listing, index) => {
    const category = categoryByCode.get(listing.category)
    return {
      id: `${listing.category}-${index + 1}`,
      title: listing.title,
      description: listing.description,
      unit: listing.unit,
      // Рубли в копейки: в базе деньги только целыми копейками (§6)
      priceKopecks: BigInt(listing.rubles) * 100n,
      minQty: '1',
      leadTimeHours: listing.leadHours,
      categoryId: category?.id ?? listing.category,
      categoryName: category?.name ?? listing.category,
      categoryCode: listing.category,
      contractorId: contractor.inn,
      contractorOrgId: contractor.inn,
      contractorName: contractor.name,
      contractorRating: contractor.rating,
      // Демо-компании никто не проверял, и притворяться обратным нельзя:
      // «проверен ИНН» — часть обещания площадки, а не украшение карточки
      innVerified: false,
      zones: contractor.zones,
      zoneNames: zoneNames(contractor.zones),
    }
  }),
)

const priceCeilingKopecks = cards.reduce(
  (max, card) => (card.priceKopecks > max ? card.priceKopecks : max),
  0n,
)

/**
 * Отбор повторяет правила живой витрины: категория, округ (город покрывает
 * свои округа), поиск по названию и описанию, потолок цены включительно.
 * Порядок — по цене, как в базе при равной силе совпадения.
 */
export function storefront(input: {
  categoryId?: string | undefined
  zoneCode?: string | undefined
  query?: string | undefined
  priceToKopecks?: bigint | undefined
  limit?: number | undefined
  offset?: number | undefined
} = {}): Promise<StorefrontPage> {
  const text = input.query?.trim().toLocaleLowerCase('ru')
  const zones = input.zoneCode ? new Set(catalog.coveringCodes(input.zoneCode)) : null

  const found = cards
    .filter((card) => !input.categoryId || card.categoryId === input.categoryId)
    .filter((card) => input.priceToKopecks === undefined || card.priceKopecks <= input.priceToKopecks)
    .filter((card) => !zones || card.zones.some((code) => zones.has(code)))
    .filter((card) => {
      if (!text) return true
      const haystack = `${card.title} ${card.description ?? ''}`.toLocaleLowerCase('ru')
      return haystack.includes(text)
    })
    .sort((a, b) => Number(a.priceKopecks - b.priceKopecks))

  const offset = Math.max(input.offset ?? 0, 0)
  const limit = Math.min(Math.max(input.limit ?? 24, 1), 100)

  return Promise.resolve({
    items: found.slice(offset, offset + limit),
    total: found.length,
    categories,
    zones: catalog.listZones(),
    priceCeilingKopecks,
  })
}

export function storefrontCard(id: string): Promise<StorefrontCard | null> {
  return Promise.resolve(cards.find((card) => card.id === id) ?? null)
}

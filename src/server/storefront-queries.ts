import 'server-only'
import * as catalog from '@/modules/catalog'
import * as platform from '@/modules/platform'
import { zoneNames } from './zone-names'

/**
 * Чтение для витрины: то, что видит клиент.
 *
 * Название компании-подрядчика живёт в соседнем модуле и берётся его функцией,
 * а не соединением таблиц: между схемами JOIN запрещён (§4.2). Имена
 * запрашиваются одной пачкой на страницу, а не по одному на карточку.
 */

/**
 * Есть ли за витриной база.
 *
 * На боевом сервере — да. В демо на GitHub Pages базы нет вовсе, и там эта
 * функция отвечает «нет»: витрина показывает объяснение вместо пустой сетки
 * и не пытается читать фильтры из адреса, которых в наборе файлов не бывает.
 */
export function isAvailable(): boolean {
  return true
}

export type StorefrontCard = catalog.StorefrontListing & {
  contractorName: string
  innVerified: boolean
  /**
   * Код категории — для отраслевой иллюстрации на карточке.
   *
   * Берётся здесь, а не запрашивается у каталога отдельным полем: категории
   * на страницу и так читаются целиком для фильтров, и это тот же список.
   * Незнакомый код витрина переживает — рисует нейтральную картинку.
   */
  categoryCode: string
  /**
   * Округа выезда названиями, а не кодами: `msk-cao` — системный термин,
   * и §7.1 запрещает ему появляться на экране. Поле отдельное, а не поверх
   * `zones`, чтобы код оставался тем, по чему фильтруют.
   */
  zoneNames: string[]
}

export type StorefrontPage = {
  items: StorefrontCard[]
  total: number
  categories: catalog.Category[]
  zones: catalog.Zone[]
  /** Верх ползунка цены: самая дорогая карточка витрины, а не круглое число. */
  priceCeilingKopecks: bigint
}

export async function storefront(input: {
  categoryId?: string | undefined
  zoneCode?: string | undefined
  query?: string | undefined
  priceToKopecks?: bigint | undefined
  limit?: number | undefined
  offset?: number | undefined
}): Promise<StorefrontPage> {
  const [found, categories, priceCeilingKopecks] = await Promise.all([
    catalog.searchListings(input),
    catalog.listCategories({ activeOnly: true }),
    catalog.storefrontPriceCeiling(),
  ])

  return {
    items: await withContractorNames(found.items, categories),
    total: found.total,
    categories,
    zones: catalog.listZones(),
    priceCeilingKopecks,
  }
}

export async function storefrontCard(id: string): Promise<StorefrontCard | null> {
  const listing = await catalog.getStorefrontListing(id).catch(() => null)
  if (!listing) return null
  const [card] = await withContractorNames([listing])
  return card ?? null
}

/**
 * Имена компаний одной пачкой.
 *
 * Иначе на странице из двадцати четырёх карточек было бы двадцать четыре
 * запроса за именем — та самая ошибка, которая незаметна на демо-данных
 * и заметна на первой сотне карточек.
 */
async function withContractorNames(
  listings: catalog.StorefrontListing[],
  categories?: catalog.Category[],
): Promise<StorefrontCard[]> {
  const orgIds = [...new Set(listings.map((l) => l.contractorOrgId))]
  const [orgs, allCategories] = await Promise.all([
    Promise.all(orgIds.map((id) => platform.getOrg(id).catch(() => null))),
    categories ? Promise.resolve(categories) : catalog.listCategories({}),
  ])
  const byId = new Map(orgs.filter((o) => o !== null).map((o) => [o.id, o]))
  const codeById = new Map(allCategories.map((c) => [c.id, c.code]))

  return listings.map((listing) => {
    const org = byId.get(listing.contractorOrgId)
    return {
      ...listing,
      contractorName: org?.name ?? 'Компания скрыта',
      // Проверенный ИНН — часть обещания площадки: клиент должен видеть,
      // что подрядчик не аноним
      innVerified: org?.innVerifiedAt !== null && org?.innVerifiedAt !== undefined,
      categoryCode: codeById.get(listing.categoryId) ?? '',
      zoneNames: zoneNames(listing.zones),
    }
  })
}

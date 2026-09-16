import { isAvailable, storefront, storefrontCard } from '@/server/storefront-queries'
import { CatalogError } from '@/modules/catalog'
import { Filters } from './filters'
import { ListingDetails, NotPublished, Results, StorefrontIntro } from './catalog-view'
import { siteChoices } from '@/server/deal-queries'
import { requireUser } from '@/server/session'
import { DemoStorefront } from './demo-storefront'

/**
 * Витрина, и она же главная страница.
 *
 * Каталог — основной путь клиента (§1), а §7.1 требует, чтобы главная отвечала
 * на вопрос «что мне делать сейчас». Отдельный начальный экран перед каталогом
 * отвечал бы на него хуже, чем сам каталог, поэтому его нет: человек попадает
 * сразу на услуги — как в утверждённом макете `design/Main.dc.html`.
 *
 * Папка называется `(storefront)` в скобках: скобки означают, что в адресе
 * её нет — витрина живёт на `/`. Папка нужна ради состояний загрузки и ошибки
 * рядом с ней: без неё они стали бы общими для всех экранов приложения,
 * и на кабинете клиента показывался бы скелет каталога.
 *
 * Здесь только данные и состояния. Оформление — в `catalog-view.tsx`,
 * чтобы правки вида и правки логики не сталкивались в одном файле (§12).
 *
 * Четыре состояния витрины (§7.4) разведены по местам, как принято в Next:
 * загрузка — `loading.tsx`, ошибка — `error.tsx`, пустой результат
 * и успех — здесь.
 *
 * Страница услуги открывается по `?id=`, а не отдельным адресом
 * `/uslugi/<номер>`. Причина техническая: демо на GitHub Pages собирается
 * без базы, а адрес с подставляемым куском там требует заранее перечислить
 * все номера — перечислять нечего, и сборка отказывается.
 * ЧТО СДЕЛАТЬ ПОТОМ: когда появится боевой сервер и демо перестанет быть
 * набором файлов, вернуть человеческий адрес услуги — для ссылок, которыми
 * делятся, и для поисковиков он заметно лучше.
 */

const PAGE_SIZE = 24

type Search = { category?: string; zone?: string; q?: string; priceTo?: string; id?: string }

export default async function StorefrontPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  // В демо базы нет, и карточки там показываются выдуманные — те же, которыми
  // засевается база для разработки. Отбор в демо идёт в браузере: страница
  // собрана заранее, и сервер, который мог бы отобрать, там отсутствует
  if (!isAvailable()) return <DemoStorefront page={await storefront({ limit: 100 })} />

  const params = await searchParams

  if (params.id) {
    const card = await storefrontCard(params.id)
    // Точки клиента нужны форме заказа. Берём их здесь, а не запросом
    // из браузера: роут не собирается в набор файлов без сервера, и демо
    // на GitHub Pages сломалось бы на нём сразу
    const access = await requireUser()
    const sites = access.allowed ? await siteChoices(access.user) : []

    return card ? <ListingDetails item={card} sites={sites} /> : <NotPublished />
  }

  const hasFilters = Boolean(params.category ?? params.zone ?? params.q ?? params.priceTo)

  // Кривое число в адресе — это чужая ссылка или опечатка, а не повод
  // показать пустую витрину: фильтр просто не применяется
  const priceTo = /^\d+$/.test(params.priceTo ?? '') ? BigInt(params.priceTo!) : undefined

  // Неизвестная зона в адресе — это опечатка или чужая ссылка, а не повод
  // показать пустую витрину: сбрасываем фильтр и показываем всё
  const page = await storefront({
    categoryId: params.category,
    zoneCode: params.zone,
    query: params.q,
    priceToKopecks: priceTo,
    limit: PAGE_SIZE,
  }).catch((error: unknown) => {
    if (error instanceof CatalogError) {
      return storefront({
        categoryId: params.category,
        query: params.q,
        priceToKopecks: priceTo,
        limit: PAGE_SIZE,
      })
    }
    throw error
  })

  return (
    <>
      <StorefrontIntro />

      <Filters
        categories={page.categories}
        zones={page.zones}
        current={params}
        maxPriceKopecks={page.priceCeilingKopecks}
      />

      <Results items={page.items} total={page.total} hasFilters={hasFilters} />
    </>
  )
}

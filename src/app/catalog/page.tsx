import { isAvailable, storefront, storefrontCard } from '@/server/storefront-queries'
import { CatalogError } from '@/modules/catalog'
import { DemoWithoutDatabase, Filters, Grid, ListingDetails, NothingFound, NotPublished } from './catalog-view'

/**
 * Витрина: основной путь клиента (§1).
 *
 * Здесь только данные и состояния. Оформление — в `catalog-view.tsx`,
 * чтобы правки вида и правки логики не сталкивались в одном файле (§12).
 *
 * Четыре состояния витрины (§7.4) разведены по местам, как принято в Next:
 * загрузка — `loading.tsx`, ошибка — `error.tsx`, пустой результат
 * и успех — здесь.
 *
 * Страница услуги открывается по `?id=`, а не отдельным адресом
 * `/catalog/<номер>`. Причина техническая: демо на GitHub Pages собирается
 * без базы, а адрес с подставляемым куском там требует заранее перечислить
 * все номера — перечислять нечего, и сборка отказывается.
 * ЧТО СДЕЛАТЬ ПОТОМ: когда появится боевой сервер и демо перестанет быть
 * набором файлов, вернуть человеческий адрес `/catalog/<номер>` — для ссылок,
 * которыми делятся, и для поисковиков он заметно лучше.
 */

const PAGE_SIZE = 24

type Search = { category?: string; zone?: string; q?: string; id?: string }

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  // В демо базы нет: говорим об этом прямо и не читаем фильтры из адреса —
  // в наборе файлов без сервера их всё равно неоткуда взять
  if (!isAvailable()) return <DemoWithoutDatabase />

  const params = await searchParams

  if (params.id) {
    const card = await storefrontCard(params.id)
    return card ? <ListingDetails item={card} /> : <NotPublished />
  }

  const hasFilters = Boolean(params.category ?? params.zone ?? params.q)

  // Неизвестная зона в адресе — это опечатка или чужая ссылка, а не повод
  // показать пустую витрину: сбрасываем фильтр и показываем всё
  const page = await storefront({
    categoryId: params.category,
    zoneCode: params.zone,
    query: params.q,
    limit: PAGE_SIZE,
  }).catch((error: unknown) => {
    if (error instanceof CatalogError) {
      return storefront({ categoryId: params.category, query: params.q, limit: PAGE_SIZE })
    }
    throw error
  })

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="text-page font-extrabold">Найти услугу</h1>
        <p className="max-w-[70ch] text-body text-ink-2">
          Выберите готовое решение с ценой. Договор, счёт и акт выпустим мы,
          деньги подрядчик получит после того, как вы примете работу.
        </p>
      </header>

      <Filters categories={page.categories} zones={page.zones} current={params} />

      {page.items.length === 0 ? (
        <NothingFound hasFilters={hasFilters} />
      ) : (
        <>
          <p className="text-caption text-ink-3">
            {page.total === page.items.length
              ? `Нашлось: ${page.total}`
              : `Показаны ${page.items.length} из ${page.total}`}
          </p>
          <Grid items={page.items} />
        </>
      )}
    </>
  )
}

'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { coveringCodes } from '@/shared/zones'
import { Filters } from './filters'
import {
  DemoDataNotice,
  ListingDetails,
  NotPublished,
  Results,
  StorefrontIntro,
} from './catalog-view'
import type { StorefrontCard, StorefrontPage } from '@/server/storefront-queries'

/**
 * Витрина демо: те же карточки и те же фильтры, но отбор идёт в браузере.
 *
 * Почему не как на живой витрине. Демо для GitHub Pages собирается набором
 * готовых файлов: сервера там нет, и страница `/?q=уборка` — это тот же
 * файл, что и `/`. Отбор на сервере в демо просто не случился бы, и поиск
 * молча ничего не делал бы — хуже, чем отсутствие поиска.
 *
 * Поэтому карточки приезжают все сразу (их восемь), а условия читаются
 * из адреса уже в браузере. Форма фильтров при этом обычная и отправляется
 * обычным способом: адрес остаётся тем же, им можно поделиться, и кнопка
 * «назад» работает.
 *
 * Правила отбора повторяют живую витрину, и это единственное место, где они
 * продублированы. Осознанно: альтернатива — тащить в браузер модуль каталога
 * вместе с доступом к базе. Когда демо перестанет быть набором файлов,
 * этот файл удаляется целиком.
 *
 * Тип импортируется как тип: `import type` стирается при сборке, поэтому
 * серверный модуль в браузер не попадает.
 */
export function DemoStorefront({ page }: { page: StorefrontPage }) {
  /**
   * Чтение адреса требует границы ожидания, иначе статическая сборка
   * отказывается собирать страницу. Ожидание показывает не скелет,
   * а витрину целиком, без условий отбора: это ровно то, что попадёт
   * в готовый файл демо. Пустая заглушка означала бы, что и в файле,
   * и у того, у кого не выполнился сценарий, витрина пустая.
   */
  return (
    <Suspense fallback={<Shell page={page} items={page.items} hasFilters={false} current={{}} />}>
      <Filtered page={page} />
    </Suspense>
  )
}

function Filtered({ page }: { page: StorefrontPage }) {
  const params = useSearchParams()

  const id = params.get('id')
  if (id) {
    const card = page.items.find((item) => item.id === id)
    if (!card) return <NotPublished />
    // Предупреждение и здесь: на карточку услуги попадают по прямой ссылке,
    // минуя витрину, и цена на ней — первое, что видит человек
    return (
      <>
        <DemoDataNotice />
        {/* В демо ни входа, ни точек: заказывать не с чего и некому */}
        <ListingDetails item={card} sites={[]} />
      </>
    )
  }

  const current: Current = {
    category: params.get('category') ?? undefined,
    zone: params.get('zone') ?? undefined,
    q: params.get('q') ?? undefined,
    priceTo: params.get('priceTo') ?? undefined,
  }
  const hasFilters = Boolean(current.category ?? current.zone ?? current.q ?? current.priceTo)

  return (
    <Shell
      page={page}
      items={select(page.items, current)}
      hasFilters={hasFilters}
      current={current}
    />
  )
}

function Shell({
  page,
  items,
  hasFilters,
  current,
}: {
  page: StorefrontPage
  items: StorefrontCard[]
  hasFilters: boolean
  current: Current
}) {
  return (
    <>
      <StorefrontIntro />
      <DemoDataNotice />

      <Filters
        categories={page.categories}
        zones={page.zones}
        current={current}
        maxPriceKopecks={page.priceCeilingKopecks}
      />

      <Results items={items} total={items.length} hasFilters={hasFilters} />
    </>
  )
}

type Current = {
  category?: string | undefined
  zone?: string | undefined
  q?: string | undefined
  priceTo?: string | undefined
}

/**
 * Отбор по тем же правилам, что и в базе: категория, округ (город покрывает
 * свои округа), поиск по названию и описанию, потолок цены включительно.
 *
 * Кривое число или неизвестный округ в адресе — это чужая ссылка или опечатка,
 * а не повод показать пустую витрину: такое условие просто не применяется.
 */
function select(cards: StorefrontCard[], current: Current): StorefrontCard[] {
  const text = current.q?.trim().toLocaleLowerCase('ru')
  const zones = current.zone ? new Set(coveringCodes(current.zone)) : null
  const priceTo = /^\d+$/.test(current.priceTo ?? '') ? BigInt(current.priceTo!) : undefined

  return cards
    .filter((card) => !current.category || card.categoryId === current.category)
    .filter((card) => priceTo === undefined || card.priceKopecks <= priceTo)
    .filter((card) => !zones || card.zones.some((code) => zones.has(code)))
    .filter((card) => {
      if (!text) return true
      return `${card.title} ${card.description ?? ''}`.toLocaleLowerCase('ru').includes(text)
    })
}

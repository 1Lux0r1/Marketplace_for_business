import Link from 'next/link'
import { EmptyState, PromoTag, StatusBadge, cx } from '@/ui'
import type { StorefrontCard } from '@/server/storefront-queries'
import type { Category, Zone } from '@/modules/catalog'

/**
 * ЭТО ФАЙЛ ОФОРМЛЕНИЯ ВИТРИНЫ. Здесь только вид, ни одного запроса к данным.
 *
 * Разделение сделано намеренно: над проектом работают двое (§12), и правки
 * оформления не должны сталкиваться с правками логики в одном файле. Данные
 * и состояния собирает `page.tsx`, сюда они приходят готовыми.
 *
 * Что оформление обязано сохранить, меняя всё остальное:
 *
 * - цена — из `priceKopecks`, делится на 100 только при выводе (§6);
 * - «проверенный ИНН» показывается только когда `innVerified` истинно —
 *   это часть обещания площадки, а не украшение;
 * - у пустого результата остаётся кнопка сброса фильтра (§7.4);
 * - таблиц вместо карточек на витрине быть не должно (§7).
 */

export function Filters({
  categories,
  zones,
  current,
}: {
  categories: Category[]
  zones: Zone[]
  current: { category?: string | undefined; zone?: string | undefined; q?: string | undefined }
}) {
  return (
    <div className="flex flex-col gap-4">
      <form action="/catalog" className="flex flex-wrap gap-2">
        {current.category && <input type="hidden" name="category" value={current.category} />}
        {current.zone && <input type="hidden" name="zone" value={current.zone} />}
        <input
          name="q"
          defaultValue={current.q ?? ''}
          placeholder="Что нужно сделать на точке?"
          aria-label="Поиск по услугам"
          className="h-11 min-w-0 flex-1 rounded-pill border border-line-strong bg-surface px-4 text-body text-ink placeholder:text-ink-3"
        />
        <button
          type="submit"
          className="h-11 rounded-control bg-accent px-[18px] text-body font-semibold text-on-accent"
        >
          Найти
        </button>
      </form>

      <ChipRow
        label="Категория"
        options={[{ value: '', label: 'Все' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
        selected={current.category ?? ''}
        param="category"
        current={current}
      />
      <ChipRow
        label="Где"
        options={[{ value: '', label: 'Везде' }, ...zones.map((z) => ({ value: z.code, label: z.name }))]}
        selected={current.zone ?? ''}
        param="zone"
        current={current}
      />
    </div>
  )
}

function ChipRow({
  label,
  options,
  selected,
  param,
  current,
}: {
  label: string
  options: Array<{ value: string; label: string }>
  selected: string
  param: 'category' | 'zone'
  current: { category?: string | undefined; zone?: string | undefined; q?: string | undefined }
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-caption font-bold tracking-wide text-ink-3 uppercase">{label}</span>
      {options.map((option) => (
        <Link
          key={option.value || 'any'}
          href={buildHref({ ...current, [param]: option.value || undefined })}
          className={cx(
            'inline-flex min-h-11 items-center rounded-pill border px-3.5 text-table font-semibold',
            selected === option.value
              ? 'border-accent bg-accent-tint text-accent-strong'
              : 'border-line-strong text-ink-2 hover:bg-surface-2',
          )}
        >
          {option.label}
        </Link>
      ))}
    </div>
  )
}

export function Grid({ items }: { items: StorefrontCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <ListingCard key={item.id} item={item} />
      ))}
    </div>
  )
}

function ListingCard({ item }: { item: StorefrontCard }) {
  return (
    <article className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <span className="text-caption font-semibold text-ink-3">{item.categoryName}</span>
        {item.innVerified && <StatusBadge tone="ok">ИНН проверен</StatusBadge>}
      </div>

      <h2 className="text-section font-extrabold text-ink">
        <Link href={`/catalog?id=${item.id}`} className="hover:text-accent-strong">
          {item.title}
        </Link>
      </h2>

      {item.description && (
        <p className="line-clamp-3 text-body text-ink-2">{item.description}</p>
      )}

      <div className="mt-auto flex flex-wrap items-baseline gap-x-2 gap-y-1 pt-2">
        <span className="num text-page font-extrabold text-ink">{rubles(item.priceKopecks)}</span>
        <span className="text-body text-ink-3">за {item.unit}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-caption text-ink-3">
        <span>{item.contractorName}</span>
        {item.leadTimeHours !== null && <span>· готовы через {hours(item.leadTimeHours)}</span>}
      </div>

      <Link
        href={`/catalog?id=${item.id}`}
        className="inline-flex h-11 items-center justify-center rounded-control bg-accent text-body font-semibold text-on-accent"
      >
        Посмотреть
      </Link>
    </article>
  )
}

export function NothingFound({ hasFilters }: { hasFilters: boolean }) {
  return (
    <EmptyState
      title={hasFilters ? 'Под эти условия ничего не нашлось' : 'Витрина пока пуста'}
      description={
        hasFilters
          ? 'Попробуйте выбрать другую категорию, расширить зону до «Везде» или убрать поиск.'
          : 'Услуги появятся, когда подрядчики опубликуют свои карточки.'
      }
      action={
        hasFilters ? (
          <Link
            href="/catalog"
            className="inline-flex h-11 items-center rounded-control bg-accent px-[18px] text-body font-semibold text-on-accent"
          >
            Сбросить фильтры
          </Link>
        ) : undefined
      }
    />
  )
}

/** Демо на GitHub Pages: там нет базы, и витрине нечего показывать. */
export function DemoWithoutDatabase() {
  return (
    <EmptyState
      title="Это демо без базы данных"
      description="Здесь видно, как устроены экраны, но живых услуг нет: витрина читает их из базы, а в демо её не бывает. На рабочей установке этот раздел показывает настоящий каталог."
    />
  )
}

/** Карточки нет или она снята с витрины: по прямой ссылке это одно и то же. */
export function NotPublished() {
  return (
    <EmptyState
      title="Такой услуги на витрине нет"
      description="Возможно, подрядчик снял её или ссылка устарела. Посмотрите, что есть сейчас."
      action={
        <Link
          href="/catalog"
          className="inline-flex h-11 items-center rounded-control bg-accent px-[18px] text-body font-semibold text-on-accent"
        >
          Ко всем услугам
        </Link>
      }
    />
  )
}

export function ListingDetails({ item }: { item: StorefrontCard }) {
  return (
    <div className="flex flex-col gap-7">
      <Link
        href="/catalog"
        className="inline-flex min-h-11 items-center self-start text-body font-semibold text-accent-strong"
      >
        ← ко всем услугам
      </Link>

      <header className="flex flex-col gap-3">
        <span className="text-caption font-semibold text-ink-3">{item.categoryName}</span>
        <h1 className="max-w-[24ch] text-display font-extrabold text-ink">{item.title}</h1>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="num text-display font-extrabold text-ink">
            {rubles(item.priceKopecks)}
          </span>
          <span className="text-lead text-ink-3">за {item.unit}</span>
          {Number(item.minQty) > 1 && (
            <PromoTag>от {Number(item.minQty).toLocaleString('ru-RU')} {item.unit}</PromoTag>
          )}
        </div>
      </header>

      {item.description && (
        <section className="flex flex-col gap-2">
          <h2 className="text-section font-extrabold">Что входит</h2>
          <p className="max-w-[70ch] text-body text-ink-2">{item.description}</p>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-section font-extrabold">Кто выполняет</h2>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-lead font-bold text-ink">{item.contractorName}</span>
          {item.innVerified && <StatusBadge tone="ok">ИНН проверен</StatusBadge>}
        </div>
        {item.leadTimeHours !== null && (
          <p className="text-body text-ink-2">Готовы приступить через {hours(item.leadTimeHours)}.</p>
        )}
      </section>

      <Guarantee />

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled
          className="inline-flex h-13 items-center justify-center rounded-control bg-accent px-6 text-lead font-semibold text-on-accent disabled:opacity-50"
        >
          Заказать
        </button>
        <p className="text-caption text-ink-3">
          Заказ из каталога появится в четвёртом спринте — сейчас кнопка неактивна.
        </p>
      </div>
    </div>
  )
}

/**
 * Обещание площадки. Это не украшение страницы, а то, за что берётся
 * комиссия (§1), поэтому написано на карточке каждой услуги.
 */
function Guarantee() {
  const points = [
    ['Деньги ждут приёмки', 'Оплата лежит у площадки и уходит подрядчику только после того, как вы подписали акт.'],
    ['Документы выпустим мы', 'Договор, счёт и акт — на нашей стороне, подписывать бумаги с подрядчиком не нужно.'],
    ['Спор разбираем мы', 'Если работа сделана не так, деньги не уходят до разбора.'],
  ]

  return (
    <section className="flex flex-col gap-3 rounded-card border border-line bg-surface-2 p-5">
      <h2 className="text-section font-extrabold">Как защищена сделка</h2>
      <dl className="flex flex-col gap-3">
        {points.map(([title, text]) => (
          <div key={title} className="flex flex-col gap-0.5">
            <dt className="text-table font-bold text-ink">{title}</dt>
            <dd className="max-w-[70ch] text-body text-ink-2">{text}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

// ─── Формат ─────────────────────────────────────────────────────────────

/** Копейки в рубли — только в слое отображения (§6). */
function rubles(kopecks: bigint): string {
  return `${Number(kopecks / 100n).toLocaleString('ru-RU')} ₽`
}

function hours(value: number): string {
  if (value < 24) return `${value} ч`
  const days = Math.round(value / 24)
  const word = days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'
  return `${days} ${word}`
}

function buildHref(state: {
  category?: string | undefined
  zone?: string | undefined
  q?: string | undefined
}): string {
  const query = new URLSearchParams()
  if (state.category) query.set('category', state.category)
  if (state.zone) query.set('zone', state.zone)
  if (state.q) query.set('q', state.q)
  return query.size > 0 ? `/catalog?${query}` : '/catalog'
}

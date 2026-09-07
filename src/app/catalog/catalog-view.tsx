import Link from 'next/link'
import {
  Button,
  CategoryArt,
  CategoryLabel,
  EmptyState,
  GuaranteeBand,
  GuaranteeLine,
  Rating,
  VerifiedMark,
} from '@/ui'
import { formatKopecks } from '@/shared/money'
import type { StorefrontCard } from '@/server/storefront-queries'

/**
 * ЭТО ФАЙЛ ОФОРМЛЕНИЯ ВИТРИНЫ. Здесь только вид, ни одного запроса к данным.
 *
 * Разделение сделано намеренно: над проектом работают двое (§12), и правки
 * оформления не должны сталкиваться с правками логики в одном файле. Данные
 * и состояния собирает `page.tsx`, сюда они приходят готовыми.
 *
 * Оформлено по утверждённым макетам `design/Main.dc.html` и `Listing.dc.html`.
 * Витрина продаёт, а рабочие экраны работают (§7): здесь есть иллюстрация,
 * крупная цена и обещание гаранта — то, чего в сделке и документах не будет.
 *
 * Чего в макете есть, а здесь нет, и почему: бейджа скидки («−15 %») и числа
 * закрытых заказов. Ни того ни другого нет в данных, а выдумывать их нельзя
 * (§9.7). Появятся поля — появятся и они, места под них оставлены.
 *
 * Что оформление обязано сохранить, меняя всё остальное:
 *
 * - цена выводится через `formatKopecks` и никак иначе (§6);
 * - «проверен» показывается только когда `innVerified` истинно —
 *   это часть обещания площадки, а не украшение;
 * - у пустого результата остаётся кнопка сброса фильтра (§7.4);
 * - таблиц вместо карточек на витрине быть не должно (§7).
 */

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
    <article className="relative flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition-shadow duration-150 hover:shadow-raised">
      <CategoryArt categoryCode={item.categoryCode} className="h-[156px]" />

      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <CategoryLabel categoryCode={item.categoryCode}>{item.categoryName}</CategoryLabel>

        {/* Ссылка растянута на всю карточку: на витрине человек целится
            в карточку, а не в её заголовок */}
        <h2 className="text-lead font-extrabold text-ink">
          <Link href={`/catalog?id=${item.id}`} className="after:absolute after:inset-0 hover:text-accent-strong">
            {item.title}
          </Link>
        </h2>

        {item.description && (
          <p className="line-clamp-2 text-table text-ink-2">{item.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-caption text-ink-3">
          <span className="text-ink-2">{item.contractorName}</span>
          {item.innVerified && <VerifiedMark />}
          <Rating value={item.contractorRating} />
        </div>

        {/* Цена внизу и одинаково у всех карточек: её сравнивают взглядом
            по сетке, а не ищут в каждой карточке заново */}
        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pt-2">
          <span className="num text-page font-extrabold text-accent-strong">
            {formatKopecks(item.priceKopecks)}
          </span>
          <span className="text-table text-ink-3">за {item.unit}</span>
        </div>

        {item.leadTimeHours !== null && (
          <p className="text-caption text-ink-3">Готовы приступить через {hours(item.leadTimeHours)}</p>
        )}
      </div>
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
          <Button href="/catalog">
            Сбросить фильтры
          </Button>
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
        <Button href="/catalog">
          Ко всем услугам
        </Button>
      }
    />
  )
}

export function ListingDetails({ item }: { item: StorefrontCard }) {
  return (
    <div className="flex flex-col gap-7">
      <Link
        href="/catalog"
        className="inline-flex min-h-11 items-center self-start text-body font-semibold text-accent-strong hover:text-accent"
      >
        ← ко всем услугам
      </Link>

      <div className="grid gap-7 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-7">
          <header className="flex flex-col gap-3">
            <span className="text-label font-bold tracking-[0.08em] text-ink-3 uppercase">
              {item.categoryName}
            </span>
            <h1 className="max-w-[24ch] text-page font-extrabold text-ink">{item.title}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="text-lead font-bold text-ink">{item.contractorName}</span>
              {item.innVerified && <VerifiedMark label="ИНН проверен" />}
              <Rating value={item.contractorRating} />
            </div>
          </header>

          {item.description && (
            <section className="flex flex-col gap-2">
              <h2 className="text-section font-bold">Что входит в услугу</h2>
              <p className="max-w-[70ch] text-body text-ink-2">{item.description}</p>
            </section>
          )}

          <Guarantee />
        </div>

        {/* Цена и заказ — отдельным блоком справа и липкие: на длинной странице
            человек не должен возвращаться наверх, чтобы вспомнить цену */}
        <aside className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5 shadow-card lg:sticky lg:top-6">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="num text-display font-extrabold text-ink">
              {formatKopecks(item.priceKopecks)}
            </span>
            <span className="text-body text-ink-3">за {item.unit}</span>
          </div>

          {Number(item.minQty) > 1 && (
            <p className="text-caption text-ink-2">
              Минимальный заказ — {Number(item.minQty).toLocaleString('ru-RU')} {item.unit}
            </p>
          )}
          {item.leadTimeHours !== null && (
            <p className="text-caption text-ink-2">
              Готовы приступить через {hours(item.leadTimeHours)}
            </p>
          )}

          {/* Куда приедут — первый вопрос клиента, и ответ на него не должен
              находиться только через фильтр */}
          {item.zones.length > 0 && (
            <p className="text-caption text-ink-2">
              Выезд: <span className="text-ink">{item.zones.join(', ')}</span>
            </p>
          )}

          <Button size="lg" block disabled>
            Заказать
          </Button>
          <p className="text-caption text-ink-3">
            Заказ из каталога появится в четвёртом спринте — сейчас кнопка неактивна.
          </p>

          <div className="border-t border-line pt-3">
            <GuaranteeLine />
          </div>
        </aside>
      </div>
    </div>
  )
}

/**
 * Обещание площадки. Это не украшение страницы, а то, за что берётся
 * комиссия (§1), поэтому написано на карточке каждой услуги.
 *
 * Шагами по порядку, а не списком свойств: человек спрашивает «что будет
 * после того, как я нажму», и ответ на это — последовательность, а не набор.
 */
function Guarantee() {
  const steps = [
    ['Вы платите площадке', 'Деньги приходят нам и удерживаются. Подрядчик их пока не видит.'],
    ['Подрядчик выполняет работу', 'Мы держим срок и отвечаем на вопросы по ходу работ.'],
    ['Вы принимаете работу', 'Подписываете акт. Что-то не так — заявляете рекламацию, деньги остаются у нас.'],
    ['Подрядчик получает выплату', 'Только после подписанного акта, за вычетом комиссии.'],
  ]

  return (
    <section className="flex flex-col gap-4 rounded-card border border-accent bg-surface p-5">
      <h2 className="text-section font-bold">Как защищена сделка</h2>
      <ol className="flex flex-col gap-3.5">
        {steps.map(([title, text], i) => (
          <li key={title} className="flex gap-3.5">
            <span className="num flex size-6 flex-none items-center justify-center rounded-full bg-accent-tint text-caption font-extrabold text-accent-strong">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-table font-bold text-ink">{title}</p>
              <p className="max-w-[70ch] text-table text-ink-2">{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export { GuaranteeBand }

// ─── Формат ─────────────────────────────────────────────────────────────

function hours(value: number): string {
  if (value < 24) return `${value} ч`
  const days = Math.round(value / 24)
  const word = days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'
  return `${days} ${word}`
}

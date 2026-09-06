import Link from 'next/link'
import { EmptyState, StatusBadge, TableFrame, Td, Th, cx } from '@/ui'
import {
  categoryOptions,
  contractorDetails,
  contractorRows,
  requireOperator,
  zoneOptions,
} from '@/server/catalog-queries'
import type { ContractorStatus } from '@/modules/catalog'
import { ContractorForm } from './contractor-form'

/**
 * Подрядчики глазами оператора: список с фильтрами и карточка.
 *
 * Карточка открывается на этой же странице по `?id=`, а не отдельным адресом
 * с номером внутри. Так демо на GitHub Pages собирается без базы: адрес
 * с подставляемым куском там пришлось бы заранее перечислять поштучно.
 *
 * Оператор знает системные термины (§7.1) — «статус» и «категория» здесь
 * называются своими именами, в отличие от экранов клиента.
 */

const STATUS_LABELS: Record<ContractorStatus, string> = {
  draft: 'Черновик',
  active: 'Активен',
  paused: 'На паузе',
  blocked: 'Заблокирован',
}

const STATUS_TONE: Record<ContractorStatus, 'ok' | 'warn' | 'err' | 'neutral'> = {
  draft: 'neutral',
  active: 'ok',
  paused: 'warn',
  blocked: 'err',
}

type Search = { status?: string; category?: string; id?: string; new?: string }

export default async function ContractorsPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  const access = await requireOperator()
  if (!access.allowed) return <NoAccess reason={access.reason} />

  const params = await searchParams
  const [categories, rows] = await Promise.all([
    categoryOptions(),
    contractorRows({
      status: isStatus(params.status) ? params.status : undefined,
      categoryId: params.category,
    }),
  ])
  const zones = zoneOptions()

  const details = params.id ? await contractorDetails(params.id) : null
  const creating = params.new === '1'

  return (
    <>
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-page font-extrabold">
          {creating ? 'Новый подрядчик' : details ? details.orgName : 'Подрядчики'}
        </h1>
        {!creating && !details && (
          <Link
            href="/operator/contractors?new=1"
            className="inline-flex h-11 items-center rounded-control bg-accent px-[18px] text-body font-semibold text-on-accent"
          >
            Завести подрядчика
          </Link>
        )}
      </header>

      {creating ? (
        <div className="flex flex-col gap-7">
          <BackLink />
          <ContractorForm categories={categories} zones={zones} />
        </div>
      ) : details ? (
        <Details details={details} categories={categories} zones={zones} />
      ) : (
        <>
          <Filters current={params} categories={categories} />
          <ContractorList rows={rows} filtered={Boolean(params.status ?? params.category)} />
        </>
      )}
    </>
  )
}

function BackLink() {
  return (
    <Link
      href="/operator/contractors"
      className="inline-flex min-h-11 items-center self-start text-body font-semibold text-accent-strong"
    >
      ← ко всем подрядчикам
    </Link>
  )
}

function ContractorList({
  rows,
  filtered,
}: {
  rows: Awaited<ReturnType<typeof contractorRows>>
  filtered: boolean
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title={filtered ? 'Под фильтр никто не подошёл' : 'Подрядчиков пока нет'}
        description={
          filtered
            ? 'Снимите фильтр или заведите подрядчика с этой категорией.'
            : 'Заведите первого — или наполните базу демо-данными командой pnpm db:seed.'
        }
        action={
          <Link
            href="/operator/contractors?new=1"
            className="inline-flex h-11 items-center rounded-control bg-accent px-[18px] text-body font-semibold text-on-accent"
          >
            Завести подрядчика
          </Link>
        }
      />
    )
  }

  return (
    <TableFrame>
      <thead>
        <tr>
          <Th>Компания</Th>
          <Th>Статус</Th>
          <Th>Категории</Th>
          <Th numeric>Зон</Th>
          <Th numeric>Рейтинг</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td>
              <Link
                href={`/operator/contractors?id=${row.id}`}
                className="font-semibold text-accent-strong underline underline-offset-2"
              >
                {row.orgName}
              </Link>
              {row.inn && <div className="num text-caption text-ink-3">ИНН {row.inn}</div>}
            </Td>
            <Td>
              <StatusBadge tone={STATUS_TONE[row.status]}>{STATUS_LABELS[row.status]}</StatusBadge>
            </Td>
            <Td>
              {row.categories.length > 0 ? (
                row.categories.join(', ')
              ) : (
                <span className="text-err-strong">не назначены</span>
              )}
            </Td>
            <Td numeric>
              {row.zones}
            </Td>
            <Td numeric>
              {row.manualRating ?? '—'}
            </Td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  )
}

function Filters({
  current,
  categories,
}: {
  current: Search
  categories: Awaited<ReturnType<typeof categoryOptions>>
}) {
  const statuses: Array<ContractorStatus | 'all'> = ['all', 'active', 'draft', 'paused', 'blocked']

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-caption font-bold tracking-wide text-ink-3 uppercase">Статус</span>
        {statuses.map((status) => {
          const active = status === 'all' ? !current.status : current.status === status
          const query = new URLSearchParams()
          if (status !== 'all') query.set('status', status)
          if (current.category) query.set('category', current.category)
          return (
            <Link
              key={status}
              href={`/operator/contractors${query.size > 0 ? `?${query}` : ''}`}
              className={cx(
                'inline-flex min-h-11 items-center rounded-pill border px-3.5 text-table font-semibold',
                active
                  ? 'border-accent bg-accent-tint text-accent-strong'
                  : 'border-line-strong text-ink-2 hover:bg-surface-2',
              )}
            >
              {status === 'all' ? 'Все' : STATUS_LABELS[status]}
            </Link>
          )
        })}
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption font-bold tracking-wide text-ink-3 uppercase">
            Категория
          </span>
          {[{ id: '', name: 'Любая' }, ...categories].map((category) => {
            const active = category.id === '' ? !current.category : current.category === category.id
            const query = new URLSearchParams()
            if (current.status) query.set('status', current.status)
            if (category.id) query.set('category', category.id)
            return (
              <Link
                key={category.id || 'any'}
                href={`/operator/contractors${query.size > 0 ? `?${query}` : ''}`}
                className={cx(
                  'inline-flex min-h-11 items-center rounded-pill border px-3.5 text-table font-semibold',
                  active
                    ? 'border-accent bg-accent-tint text-accent-strong'
                    : 'border-line-strong text-ink-2 hover:bg-surface-2',
                )}
              >
                {category.name}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Details({
  details,
  categories,
  zones,
}: {
  details: NonNullable<Awaited<ReturnType<typeof contractorDetails>>>
  categories: Awaited<ReturnType<typeof categoryOptions>>
  zones: ReturnType<typeof zoneOptions>
}) {
  return (
    <div className="flex flex-col gap-7">
      <BackLink />

      <ContractorForm
        categories={categories}
        zones={zones}
        existing={{
          id: details.card.id,
          orgName: details.orgName,
          inn: details.inn,
          status: details.card.status,
          categoryIds: details.card.categories.map((c) => c.id),
          zoneCodes: details.card.zones.map((z) => z.code),
        }}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-section font-extrabold">Карточки в каталоге</h2>
        {details.listings.length === 0 ? (
          <p className="text-body text-ink-2">
            Карточек нет. Подрядчик заводит их сам — это спринт 02.
          </p>
        ) : (
          <TableFrame>
            <thead>
              <tr>
                <Th>Название</Th>
                <Th>Единица</Th>
                <Th numeric>Цена</Th>
                <Th>Статус</Th>
              </tr>
            </thead>
            <tbody>
              {details.listings.map((listing) => (
                <tr key={listing.id}>
                  <Td>{listing.title}</Td>
                  <Td>{listing.unit}</Td>
                  <Td numeric>
                    {formatRubles(listing.priceKopecks)}
                  </Td>
                  <Td>{listing.status}</Td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
      </section>
    </div>
  )
}

function NoAccess({ reason }: { reason: 'anonymous' | 'forbidden' }) {
  return (
    <EmptyState
      title={reason === 'anonymous' ? 'Нужно войти' : 'Этот раздел для операторов площадки'}
      description={
        reason === 'anonymous'
          ? 'Войдите под учётной записью оператора — кнопка «Войти» в правом верхнем углу.'
          : 'У вашей учётной записи нет прав оператора. Если они нужны — попросите администратора.'
      }
    />
  )
}

function isStatus(value: string | undefined): value is ContractorStatus {
  return value === 'draft' || value === 'active' || value === 'paused' || value === 'blocked'
}

/** Копейки в рубли — только в слое отображения (§6). */
function formatRubles(kopecks: bigint): string {
  const rubles = Number(kopecks / 100n)
  return `${rubles.toLocaleString('ru-RU')} ₽`
}

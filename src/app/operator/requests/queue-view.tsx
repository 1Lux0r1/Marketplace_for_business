import Link from 'next/link'
import { EmptyState, PageBody, PageHeader, StatusBadge, TableFrame, Td, Th } from '@/ui'
import type { RequestCard, RequestsPage } from '@/server/request-queries'

/**
 * ЭТО ФАЙЛ ОФОРМЛЕНИЯ ОЧЕРЕДИ ЗАЯВОК. Здесь только вид.
 *
 * Что оформление обязано сохранить:
 *
 * - **текст заявки целиком виден в карточке.** Это главное в заявке: человек
 *   написал своими словами, и пересказывать его нельзя;
 * - номер заявки виден в списке — по нему её ищут;
 * - компания и адрес рядом: оператор решает, кому это отдать.
 */

export function Queue({ page }: { page: RequestsPage }) {
  return (
    <>
      <PageHeader
        title="Заявки"
        description="Задачи, под которые в каталоге нет готовой услуги. Разбираем и передаём подрядчикам."
      />

      <PageBody>
        {page.items.length === 0 ? (
          <EmptyState
            title="Заявок нет"
            description="Здесь появятся задачи, которые клиенты описали своими словами. Пока таких нет — значит всё нужное нашлось в каталоге."
          />
        ) : (
          <TableFrame>
            <thead>
              <tr>
                <Th numeric>№</Th>
                <Th>Что нужно</Th>
                <Th>Кто и куда</Th>
                <Th>Срочность</Th>
                <Th>Когда</Th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((row) => (
                <tr key={row.id}>
                  <Td numeric>
                    <Link
                      href={`/operator/requests?id=${row.id}`}
                      className="num font-bold text-accent-strong"
                    >
                      №{row.number}
                    </Link>
                  </Td>
                  <Td>
                    <Link href={`/operator/requests?id=${row.id}`} className="font-semibold text-ink">
                      {row.title}
                    </Link>
                    {row.categoryName && (
                      <div className="text-caption text-ink-3">{row.categoryName}</div>
                    )}
                  </Td>
                  <Td>
                    <div>{row.companyName ?? '—'}</div>
                    <div className="text-caption text-ink-3">
                      {[row.address, row.zoneName].filter(Boolean).join(' · ')}
                    </div>
                  </Td>
                  <Td>{row.urgency}</Td>
                  <Td>
                    <div className="text-caption text-ink-3">{moscow(row.createdAt)}</div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
      </PageBody>
    </>
  )
}

export function RequestDetails({ card }: { card: RequestCard | null }) {
  if (!card) {
    return (
      <EmptyState
        title="Такой заявки нет"
        description="Возможно, ссылка устарела. Посмотрите очередь целиком."
        action={
          <Link
            href="/operator/requests"
            className="inline-flex h-11 items-center rounded-control bg-accent px-[18px] text-body font-semibold text-on-accent"
          >
            Ко всем заявкам
          </Link>
        }
      />
    )
  }

  return (
    <>
      <PageHeader
        title={`Заявка №${card.number}`}
        breadcrumbs={[
          { href: '/operator/requests', label: 'Заявки' },
          { href: `/operator/requests?id=${card.id}`, label: `№${card.number}` },
        ]}
        description={[card.companyName, card.urgency].filter(Boolean).join(' · ')}
      />

      <PageBody>
        <section className="flex flex-col gap-2">
          <h2 className="text-section font-extrabold">Что написал клиент</h2>
          {/* Текст клиента показывается как есть и целиком: пересказывать
              его нельзя, в нём и есть вся заявка */}
          <p className="max-w-[70ch] whitespace-pre-wrap text-body text-ink">
            {card.rawText ?? 'Без описания'}
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-section font-extrabold">Куда ехать</h2>
          <dl className="flex max-w-[70ch] flex-col gap-2 rounded-card border border-line bg-surface p-5">
            <Pair label="Адрес" value={card.address ?? '—'} />
            <Pair label="Округ" value={card.zoneName ?? '—'} />
            <Pair label="Кто встретит" value={card.contact ?? 'не указан'} />
            {card.desiredAt && <Pair label="Нужно к" value={moscow(card.desiredAt)} />}
            <Pair label="Категория" value={card.categoryName ?? 'клиент не выбрал'} />
          </dl>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-section font-extrabold">Что с ней</h2>
          <div>
            <StatusBadge tone={card.statusKind === 'done' ? 'ok' : card.statusKind === 'stop' ? 'err' : 'warn'}>
              {card.status}
            </StatusBadge>
          </div>
          <ol className="flex flex-col gap-1 text-caption text-ink-2">
            {card.history.map((event, i) => (
              <li key={`${event.what}-${i}`}>
                {event.what} — {moscow(event.when)}
              </li>
            ))}
          </ol>
          <p className="max-w-[70ch] text-caption text-ink-3">
            Подбор подрядчиков и предложения по заявке появятся в следующей задаче.
          </p>
        </section>
      </PageBody>
    </>
  )
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <dt className="min-w-[12ch] text-caption font-semibold text-ink-3">{label}</dt>
      <dd className="text-body text-ink">{value}</dd>
    </div>
  )
}

export function NotYours({ reason }: { reason: 'anonymous' | 'forbidden' }) {
  return (
    <EmptyState
      title={reason === 'anonymous' ? 'Нужно войти' : 'Этот раздел для сотрудников площадки'}
      description={
        reason === 'anonymous'
          ? 'Очередь открывается после входа — кнопка «Войти» в правом верхнем углу.'
          // Этот текст читает клиент, поэтому «заявок» в нём нет: для него
          // это его заказы, и раздел называется так же (§7.1)
          : 'Этот список разбирают сотрудники площадки. Свои задачи вы найдёте в разделе «Мои заказы».'
      }
    />
  )
}

export function DemoWithoutDatabase() {
  return (
    <EmptyState
      title="Это демо без базы данных"
      description="Здесь видно, как устроена очередь заявок, но живых заявок нет: они читаются из базы, а в демо её не бывает."
    />
  )
}

function moscow(when: Date): string {
  return when.toLocaleDateString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

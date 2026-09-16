'use client'

import { useState } from 'react'
import { EmptyState, PageBody, PageHeader, StatusBadge, TableFrame, Td, Th } from '@/ui'
import type { RequestRow, RequestsPage } from '@/server/request-queries'
import type { DealRow, DealsPage } from '@/server/deal-queries'
import { DealActions } from './deal-actions-buttons'
import type { Category } from '@/modules/catalog'
import { RequestForm } from './request-form'

/**
 * ЭТО ФАЙЛ ОФОРМЛЕНИЯ «МОИХ ЗАКАЗОВ». Здесь только вид.
 *
 * Сейчас здесь заявки — задачи, под которые в каталоге нет готовой услуги.
 * Слова «заявка» на экране у клиента быть не должно (§7.1): для него это
 * заказ, а «заявка» — наше внутреннее слово. Когда появится заказ из
 * каталога, он встанет в этот же список.
 *
 * Что оформление обязано сохранить, меняя всё остальное:
 *
 * - **номер заявки виден**: его называют, когда пишут или звонят;
 * - у клиента без заявок пустое состояние объясняет и даёт кнопку (§7.4);
 * - адрес показывается словами, а не кодом зоны;
 * - главное действие на экране одно — «Описать задачу» (§7.1).
 */
export function MyOrders({
  page,
  deals,
  sites,
  categories,
}: {
  page: RequestsPage
  deals: DealsPage
  sites: Array<{ id: string; label: string; hint: string }>
  categories: Category[]
}) {
  const [writing, setWriting] = useState(false)
  const nothingYet = page.items.length === 0 && deals.items.length === 0

  return (
    <>
      <PageHeader
        title="Мои заказы"
        description="Здесь всё, что вы заказывали. Если в каталоге нет подходящей услуги — опишите задачу своими словами, и подрядчики ответят ценой и сроком."
        action={
          sites.length > 0 ? (
            <button
              type="button"
              onClick={() => setWriting(true)}
              className="inline-flex h-11 items-center rounded-control bg-accent px-[18px] text-body font-semibold text-on-accent"
            >
              Описать задачу
            </button>
          ) : undefined
        }
      />

      <PageBody>
        {sites.length === 0 ? (
          <NoSites />
        ) : nothingYet ? (
          <EmptyState
            title="Заказов пока нет"
            description="Выберите услугу в каталоге — или, если подходящей нет, опишите задачу своими словами. Мы найдём подрядчиков, они ответят ценой и сроком, а вы выберете."
            action={
              <button
                type="button"
                onClick={() => setWriting(true)}
                className="inline-flex h-11 items-center rounded-control bg-accent px-[18px] text-body font-semibold text-on-accent"
              >
                Описать задачу
              </button>
            }
          />
        ) : (
          <>
            {deals.items.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-section font-extrabold">Заказы из каталога</h2>
                <div className="flex flex-col gap-3">
                  {deals.items.map((row) => (
                    <DealCardRow key={row.id} row={row} />
                  ))}
                </div>
              </section>
            )}

            {page.items.length > 0 && (
              <section className="flex flex-col gap-3">
                {deals.items.length > 0 && (
                  <h2 className="text-section font-extrabold">Задачи своими словами</h2>
                )}
                <TableFrame>
                  <thead>
                    <tr>
                      <Th numeric>№</Th>
                      <Th>Что нужно</Th>
                      <Th>Куда</Th>
                      <Th>Когда</Th>
                      <Th>Что с ней</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.items.map((row) => (
                      <Row key={row.id} row={row} />
                    ))}
                  </tbody>
                </TableFrame>
              </section>
            )}
          </>
        )}

        {writing && (
          <RequestForm sites={sites} categories={categories} onClose={() => setWriting(false)} />
        )}
      </PageBody>
    </>
  )
}

export function Row({ row, showCompany = false }: { row: RequestRow; showCompany?: boolean }) {
  return (
    <tr>
      <Td numeric>
        <span className="num font-bold text-ink">№{row.number}</span>
      </Td>
      <Td>
        <div className="font-semibold text-ink">{row.title}</div>
        <div className="text-caption text-ink-3">
          {[row.categoryName, row.urgency].filter(Boolean).join(' · ')}
        </div>
        {showCompany && row.companyName && (
          <div className="text-caption text-ink-2">{row.companyName}</div>
        )}
      </Td>
      <Td>
        <div>{row.address ?? '—'}</div>
        {row.zoneName && <div className="text-caption text-ink-3">{row.zoneName}</div>}
      </Td>
      <Td>
        <div className="text-caption text-ink-3">{moscow(row.createdAt)}</div>
        {row.desiredAt && (
          <div className="text-caption text-ink-2">к {moscow(row.desiredAt)}</div>
        )}
      </Td>
      <Td>
        <StatusBadge tone={row.statusKind === 'done' ? 'ok' : row.statusKind === 'stop' ? 'err' : 'warn'}>
          {row.status}
        </StatusBadge>
      </Td>
    </tr>
  )
}

/**
 * Заявка всегда оформляется на точку, поэтому без точек её не оставить.
 * Пустое состояние здесь — это навигация (§7.1): оно ведёт туда, где
 * точку заводят.
 */
function NoSites() {
  return (
    <EmptyState
      title="Сначала заведите точку"
      description="Заказ оформляется на адрес, куда приедет подрядчик: кафе, салон, склад. Заведите точку в разделе «Компания» — это займёт минуту."
      action={
        <a
          href="/company"
          className="inline-flex h-11 items-center rounded-control bg-accent px-[18px] text-body font-semibold text-on-accent"
        >
          В «Компанию»
        </a>
      }
    />
  )
}

export function NeedLogin() {
  return (
    <EmptyState
      title="Нужно войти"
      description="Заказы открываются после входа — кнопка «Войти» в правом верхнем углу."
    />
  )
}

export function DemoWithoutDatabase() {
  return (
    <EmptyState
      title="Это демо без базы данных"
      description="Здесь видно, как устроен раздел заказов, но живых нет: они читаются из базы, а в демо её не бывает."
    />
  )
}

export function moscow(when: Date): string {
  return when.toLocaleDateString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Заказ карточкой, а не строкой таблицы, и это не украшение.
 *
 * У заказа есть то, чего нет у задачи: деньги и следующий шаг. Обещание
 * площадки — «ваши деньги лежат у нас до приёмки» — человек должен видеть
 * в своём заказе, а не в справке (§1). В строку таблицы это не помещается.
 */
function DealCardRow({ row }: { row: DealRow }) {
  return (
    <article className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="num text-caption font-bold text-ink-3">№{row.number}</span>
            <h3 className="text-lead font-bold text-ink">{row.title}</h3>
          </div>
          <div className="text-caption text-ink-3">
            {[row.contractorName, row.address].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {row.price && <span className="num text-section font-extrabold text-ink">{row.price}</span>}
          <StatusBadge
            tone={
              row.statusKind === 'done' ? 'ok' : row.statusKind === 'stop' ? 'err' : 'warn'
            }
          >
            {row.status}
          </StatusBadge>
        </div>
      </div>

      {/* То, за что берётся комиссия, — прямо в заказе */}
      {row.money && (
        <p className="rounded-control bg-surface-2 px-3 py-2 text-caption text-ink-2">
          {row.money}
        </p>
      )}

      <DealActions row={row} />
    </article>
  )
}

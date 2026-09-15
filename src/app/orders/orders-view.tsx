'use client'

import { useState } from 'react'
import { EmptyState, PageBody, PageHeader, StatusBadge, TableFrame, Td, Th } from '@/ui'
import type { RequestRow, RequestsPage } from '@/server/request-queries'
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
  sites,
  categories,
}: {
  page: RequestsPage
  sites: Array<{ id: string; label: string; hint: string }>
  categories: Category[]
}) {
  const [writing, setWriting] = useState(false)

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
        ) : page.items.length === 0 ? (
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

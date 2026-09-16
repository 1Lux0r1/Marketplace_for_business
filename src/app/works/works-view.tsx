'use client'

import Link from 'next/link'
import { EmptyState, PageBody, PageHeader, StatusBadge } from '@/ui'
import type { ContractorStatus } from '@/modules/catalog'
import type { DealRow, DealsPage } from '@/server/deal-queries'
import { WorkActions } from './work-actions'

/**
 * ЭТО ФАЙЛ ОФОРМЛЕНИЯ «МОИХ РАБОТ». Здесь только вид.
 *
 * Что оформление обязано сохранить:
 *
 * - **видно, что деньги уже у площадки.** Подрядчик соглашается работать
 *   до оплаты только если верит, что заплатят: «деньги у площадки» — это
 *   то, ради чего он здесь, и прятать это нельзя;
 * - номер заказа и адрес рядом: по ним он собирается ехать;
 * - главное действие одно и подписано глаголом, а не статусом.
 */
export function Works({ page, status }: { page: DealsPage; status: ContractorStatus }) {
  return (
    <>
      <PageHeader
        title="Мои работы"
        description="Заказы, которые клиенты оформили на ваши услуги. Деньги за них уже у площадки — вы получите их после того, как клиент примет работу."
      />

      <PageBody>
        {status !== 'active' && <NotActiveYet status={status} />}

        {page.items.length === 0 ? (
          <EmptyState
            title="Заказов пока нет"
            description="Здесь появятся заказы на ваши услуги из каталога. Чем точнее описана услуга и чем шире зона выезда, тем чаще вас находят."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {page.items.map((row) => (
              <WorkCard key={row.id} row={row} />
            ))}
          </div>
        )}
      </PageBody>
    </>
  )
}

function WorkCard({ row }: { row: DealRow }) {
  return (
    <article className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="num text-caption font-bold text-ink-3">№{row.number}</span>
            <h3 className="text-lead font-bold text-ink">{row.title}</h3>
          </div>
          <div className="text-caption text-ink-3">
            {[row.companyName, row.address].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {row.price && (
            <span className="num text-section font-extrabold text-ink">{row.price}</span>
          )}
          <StatusBadge
            tone={row.statusKind === 'done' ? 'ok' : row.statusKind === 'stop' ? 'err' : 'warn'}
          >
            {row.status}
          </StatusBadge>
        </div>
      </div>

      <WorkActions row={row} />
    </article>
  )
}

/**
 * Подрядчик не на витрине — значит заказов и не будет. Сказать об этом
 * прямо дешевле, чем дать ему гадать, почему пусто.
 */
function NotActiveYet({ status }: { status: ContractorStatus }) {
  const text: Record<string, string> = {
    draft: 'Мы ещё проверяем ваш ИНН. Как только проверим — ваши услуги появятся в каталоге, и клиенты смогут заказывать.',
    paused: 'Ваши услуги сняты с витрины по вашей просьбе. Новые заказы не придут, пока не вернём их обратно.',
    blocked: 'Ваши услуги сняты с витрины. Напишите нам — разберёмся, что произошло.',
  }

  return (
    <div className="rounded-card border border-warn bg-warn-tint p-4">
      <p className="text-body text-ink">{text[status] ?? 'Ваши услуги сейчас не в каталоге.'}</p>
    </div>
  )
}

export function NotAContractor() {
  return (
    <EmptyState
      title="Этот раздел для подрядчиков"
      description="Здесь подрядчики видят заказы на свои услуги. Если хотите выполнять работы на площадке — начните со страницы «Стать подрядчиком»."
      action={
        <Link
          href="/contractor/join"
          className="inline-flex h-11 items-center rounded-control bg-accent px-[18px] text-body font-semibold text-on-accent"
        >
          Стать подрядчиком
        </Link>
      }
    />
  )
}

export function NeedLogin() {
  return (
    <EmptyState
      title="Нужно войти"
      description="Ваши работы откроются после входа — кнопка «Войти» в правом верхнем углу."
    />
  )
}

export function DemoWithoutDatabase() {
  return (
    <EmptyState
      title="Это демо без базы данных"
      description="Здесь видно, как устроен раздел работ, но живых заказов нет: они читаются из базы, а в демо её не бывает."
    />
  )
}

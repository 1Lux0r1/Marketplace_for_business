import Link from 'next/link'
import { EmptyState, PageBody, PageHeader, StatusBadge, TableFrame, Td, Th } from '@/ui'
import type { DocumentRow } from '@/server/document-queries'

/**
 * ЭТО ФАЙЛ ОФОРМЛЕНИЯ ДОКУМЕНТОВ. Здесь только вид.
 *
 * Что оформление обязано сохранить:
 *
 * - **номер документа виден и его можно скопировать** — его называют
 *   в письме и в бухгалтерии;
 * - сам документ показывается КАК ЕСТЬ, своей вёрсткой: его печатают
 *   и прикладывают к отчётности, и наши стили в нём неуместны;
 * - подписанный отличается от ждущего подписи с одного взгляда.
 */

export function Documents({ rows }: { rows: DocumentRow[] }) {
  return (
    <>
      <PageHeader
        title="Документы и счета"
        description="Договоры, счета и акты по вашим заказам. Мы выпускаем их сами — подписывать бумаги с подрядчиком не нужно."
      />

      <PageBody>
        {rows.length === 0 ? (
          <EmptyState
            title="Документов пока нет"
            description="Договор и счёт появятся здесь, как только вы подтвердите первый заказ. Акт — когда подрядчик закончит работу."
            action={
              <Link
                href="/"
                className="inline-flex h-11 items-center rounded-control bg-accent px-[18px] text-body font-semibold text-on-accent"
              >
                Найти услугу
              </Link>
            }
          />
        ) : (
          <TableFrame>
            <thead>
              <tr>
                <Th>Документ</Th>
                <Th>По заказу</Th>
                <Th numeric>Сумма</Th>
                <Th numeric>Когда</Th>
                <Th>Состояние</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <Td>
                    <Link
                      href={`/documents?id=${row.id}`}
                      className="font-semibold text-accent-strong"
                    >
                      {row.kind} № {row.number}
                    </Link>
                  </Td>
                  <Td>{row.dealNumber ? `№${row.dealNumber}` : '—'}</Td>
                  <Td numeric>
                    <span className="num">{row.amount ?? '—'}</span>
                  </Td>
                  <Td numeric>
                    <time dateTime={row.issuedAt.toISOString()}>{moscow(row.issuedAt)}</time>
                  </Td>
                  <Td>
                    <StatusBadge
                      tone={
                        row.statusKind === 'done' ? 'ok' : row.statusKind === 'stop' ? 'err' : 'warn'
                      }
                    >
                      {row.status}
                    </StatusBadge>
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

export function DocumentView({ doc }: { doc: DocumentRow & { html: string } }) {
  return (
    <>
      <PageHeader
        title={`${doc.kind} № ${doc.number}`}
        breadcrumbs={[
          { href: '/documents', label: 'Документы и счета' },
          { href: `/documents?id=${doc.id}`, label: doc.number },
        ]}
        description={
          doc.statusKind === 'done'
            ? 'Подписан. Печатать и хранить можно как обычный документ.'
            : 'Ждёт подписания. Распечатать и сохранить можно уже сейчас.'
        }
      />

      <PageBody>
        {/*
          Документ показывается СВОЕЙ вёрсткой, а не нашей: его печатают
          и прикладывают к отчётности, и наши шрифты с отступами в нём
          не нужны. `sandbox` без разрешений — внутри только текст,
          выполнять там нечего.
        */}
        <iframe
          title={`${doc.kind} № ${doc.number}`}
          srcDoc={doc.html}
          sandbox=""
          className="h-[80vh] w-full rounded-card border border-line bg-white"
        />

        <p className="text-caption text-ink-3">
          Чтобы сохранить в PDF, откройте печать в браузере и выберите
          «Сохранить как PDF».
        </p>
      </PageBody>
    </>
  )
}

export function NotYours() {
  return (
    <EmptyState
      title="Такого документа нет"
      description="Возможно, ссылка устарела или документ относится к другой компании. Посмотрите свои документы."
      action={
        <Link
          href="/documents"
          className="inline-flex h-11 items-center rounded-control bg-accent px-[18px] text-body font-semibold text-on-accent"
        >
          Ко всем документам
        </Link>
      }
    />
  )
}

export function NeedLogin() {
  return (
    <EmptyState
      title="Нужно войти"
      description="Документы откроются после входа — кнопка «Войти» в правом верхнем углу."
    />
  )
}

export function DemoWithoutDatabase() {
  return (
    <EmptyState
      title="Это демо без базы данных"
      description="Здесь видно, как устроен раздел документов, но живых нет: они читаются из базы, а в демо её не бывает."
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

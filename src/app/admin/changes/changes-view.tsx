import { EmptyState, PageBody, PageHeader, Pager, TableFrame, Td, Th } from '@/ui'
import type { ChangeRow, ChangesPage } from '@/server/admin-queries'

/**
 * ЭТО ФАЙЛ ОФОРМЛЕНИЯ ЖУРНАЛА. Здесь только вид, ни одного запроса к данным.
 *
 * Что оформление обязано сохранить, меняя всё остальное:
 *
 * - **«было» и «стало» видны рядом.** Ради этого журнал и заводили: «ставка
 *   изменена» не отвечает ни на один вопрос, «было 10 %, стало 12 %» отвечает;
 * - имя автора показывается всегда — журнал отвечает на вопрос «кто»;
 * - причина показывается, когда она есть: для блокировки она обязательна;
 * - редактировать отсюда нечего, и кнопок правки быть не должно.
 */

export function ChangesView({
  page,
  current,
  perPage,
}: {
  page: ChangesPage
  current: number
  perPage: number
}) {
  return (
    <>
      <PageHeader
        title="Что меняли"
        description="Кто, что и когда изменил на площадке. Записи только читаются: править журнал нельзя ни отсюда, ни откуда-либо ещё."
      />

      <PageBody>
        {page.items.length === 0 ? (
          <EmptyState
            title="Пока ничего не меняли"
            description="Сюда попадает всё, что сотрудники площадки делают с чужими данными: подтверждение подрядчика, правка карточки, блокировка компании. Как только это случится — появится здесь."
          />
        ) : (
          <>
            <TableFrame>
              <thead>
                <tr>
                  <Th>Что произошло</Th>
                  <Th>Было</Th>
                  <Th>Стало</Th>
                  <Th>Кто</Th>
                  <Th numeric>Когда</Th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((row) => (
                  <Row key={row.id} row={row} />
                ))}
              </tbody>
            </TableFrame>

            <Pager page={current} perPage={perPage} total={page.total} />
          </>
        )}
      </PageBody>
    </>
  )
}

function Row({ row }: { row: ChangeRow }) {
  return (
    <tr>
      <Td>
        <div className="font-semibold text-ink">{row.what}</div>
        <div className="text-caption text-ink-3">{row.target}</div>
        {row.reason && <div className="mt-1 text-caption text-ink-2">Причина: {row.reason}</div>}
      </Td>
      <Td>
        <Values pairs={row.before} empty="—" />
      </Td>
      <Td>
        <Values pairs={row.after} empty="—" />
      </Td>
      <Td>
        <div>{row.who}</div>
        <div className="text-caption text-ink-3">{row.whoRole}</div>
      </Td>
      <Td numeric>
        <time dateTime={row.when.toISOString()}>{moscow(row.when)}</time>
      </Td>
    </tr>
  )
}

function Values({ pairs, empty }: { pairs: Array<[string, string]>; empty: string }) {
  if (pairs.length === 0) return <span className="text-ink-3">{empty}</span>
  return (
    <dl className="flex flex-col gap-0.5">
      {pairs.map(([field, value]) => (
        <div key={field} className="flex flex-wrap gap-x-1.5 text-caption">
          <dt className="text-ink-3">{field}:</dt>
          <dd className="font-semibold text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function NotYours({ reason }: { reason: 'anonymous' | 'forbidden' }) {
  return (
    <EmptyState
      title={reason === 'anonymous' ? 'Нужно войти' : 'Этот раздел для администратора'}
      description={
        reason === 'anonymous'
          ? 'Журнал открывается после входа — кнопка «Войти» в правом верхнем углу.'
          : 'Журнал изменений видит владелец площадки. Если он нужен вам по работе — попросите открыть доступ.'
      }
    />
  )
}

export function DemoWithoutDatabase() {
  return (
    <EmptyState
      title="Это демо без базы данных"
      description="Здесь видно, как устроен журнал, но записей нет: он читает их из базы, а в демо её не бывает."
    />
  )
}

/**
 * Время в базе хранится в UTC, показывается в московском (§6).
 * Секунды не показываем: журнал читают «когда это было», а не «в какую секунду».
 */
function moscow(when: Date): string {
  return when.toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

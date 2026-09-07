import Link from 'next/link'
import { EmptyState, TableFrame, Td, Th } from '@/ui'
import { requireOperator, verificationQueue } from '@/server/catalog-queries'
import { VerdictButtons } from './verdict-buttons'

/**
 * Очередь регистраций, которые машина проверить не смогла.
 *
 * Это не «список ошибок»: справочник компаний не подключён вовсе (Q20),
 * поэтому сюда попадает каждая новая регистрация. Когда справочник появится,
 * здесь останутся только спорные.
 */
export default async function VerificationPage() {
  const access = await requireOperator()
  if (!access.allowed) {
    return (
      <EmptyState
        title={access.reason === 'anonymous' ? 'Нужно войти' : 'Этот раздел для операторов'}
        description={
          access.reason === 'anonymous'
            ? 'Войдите под учётной записью оператора — кнопка «Войти» в правом верхнем углу.'
            : 'У вашей учётной записи нет прав оператора.'
        }
      />
    )
  }

  const rows = await verificationQueue()

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="text-page font-extrabold">Очередь проверки</h1>
        <p className="max-w-[70ch] text-body text-ink-2">
          Подрядчики, которых машина не подтвердила. Пока справочник компаний
          не подключён, сюда попадает каждая новая регистрация.
        </p>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          title="Очередь пуста"
          description="Новые регистрации подрядчиков появятся здесь. Проверять пока нечего."
          action={
            <Link
              href="/operator/contractors"
              className="inline-flex h-11 items-center rounded-control bg-accent px-[18px] text-body font-semibold text-on-accent"
            >
              Ко всем подрядчикам
            </Link>
          }
        />
      ) : (
        <TableFrame>
          <thead>
            <tr>
              <Th>Компания</Th>
              <Th>Кто зарегистрировал</Th>
              <Th>Что сказал справочник</Th>
              <Th numeric>Когда</Th>
              <Th>Решение</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <Td>
                  <div className="font-semibold text-ink">{row.orgName}</div>
                  {row.inn && <div className="num text-caption text-ink-3">ИНН {row.inn}</div>}
                </Td>
                <Td>{row.ownerName ?? '—'}</Td>
                <Td>{row.lookup ?? 'ещё не проверяли'}</Td>
                <Td numeric>
                  {row.registeredAt.toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' })}
                </Td>
                <Td>
                  <VerdictButtons contractorId={row.id} orgName={row.orgName} />
                </Td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      )}
    </>
  )
}

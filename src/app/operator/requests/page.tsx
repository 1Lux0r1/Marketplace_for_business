import {
  isAvailable,
  requestCard,
  requestQueue,
  requireOperator,
} from '@/server/request-queries'
import { DemoWithoutDatabase, NotYours, Queue, RequestDetails } from './queue-view'

/**
 * Очередь заявок у оператора.
 *
 * Права проверяются здесь, а не в меню (§6): меню решает, что показать,
 * а не что можно.
 *
 * Карточка открывается по `?id=`, а не отдельным адресом: демо собирается
 * без базы, и адрес с подставляемым куском там требует заранее перечислить
 * все номера. Тот же долг, что и у карточки услуги, — вернуть, когда демо
 * перестанет быть набором файлов.
 */
export default async function OperatorRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  if (!isAvailable()) return <DemoWithoutDatabase />

  const access = await requireOperator()
  if (!access.allowed) return <NotYours reason={access.reason} />

  const { id } = await searchParams

  if (id) {
    const card = await requestCard(access.user, id)
    return <RequestDetails card={card} />
  }

  const page = await requestQueue(access.user, { status: 'new' })
  return <Queue page={page} />
}

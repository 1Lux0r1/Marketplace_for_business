import {
  categoryOptions,
  isAvailable,
  myRequests,
  requireUser,
  siteOptions,
} from '@/server/request-queries'
import { clientDeals } from '@/server/deal-queries'
import { DemoWithoutDatabase, MyOrders, NeedLogin } from './orders-view'

/**
 * «Мои заказы» у клиента: список и форма новой задачи.
 *
 * Здесь только данные и состояния. Оформление — в `requests-view.tsx` (§12).
 *
 * Здесь и заказы из каталога, и задачи своими словами: для клиента это одно
 * и то же — «я попросил, чтобы мне сделали работу». Оба пути сходятся
 * в сделке (§1), значит сходятся и на экране.
 *
 * У клиента без заказов главный экран — это действие, а не пустая таблица
 * (§7.1): пустое состояние объясняет, что здесь появится, и даёт кнопку.
 */
export default async function RequestsPage() {
  if (!isAvailable()) return <DemoWithoutDatabase />

  const access = await requireUser()
  if (!access.allowed) return <NeedLogin />

  const [page, deals, sites, categories] = await Promise.all([
    myRequests(access.user),
    clientDeals(access.user),
    siteOptions(access.user),
    categoryOptions(),
  ])

  return <MyOrders page={page} deals={deals} sites={sites} categories={categories} />
}

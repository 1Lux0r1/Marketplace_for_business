import {
  categoryOptions,
  isAvailable,
  myRequests,
  requireUser,
  siteOptions,
} from '@/server/request-queries'
import { DemoWithoutDatabase, MyOrders, NeedLogin } from './orders-view'

/**
 * «Мои заказы» у клиента: список и форма новой задачи.
 *
 * Здесь только данные и состояния. Оформление — в `requests-view.tsx` (§12).
 *
 * У клиента без заявок главный экран — это форма, а не пустая таблица (§7.1):
 * пустое состояние обязано объяснять, что здесь появится, и давать кнопку.
 */
export default async function RequestsPage() {
  if (!isAvailable()) return <DemoWithoutDatabase />

  const access = await requireUser()
  if (!access.allowed) return <NeedLogin />

  const [page, sites, categories] = await Promise.all([
    myRequests(access.user),
    siteOptions(access.user),
    categoryOptions(),
  ])

  return <MyOrders page={page} sites={sites} categories={categories} />
}

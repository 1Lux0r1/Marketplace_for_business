import { changesPage, isAvailable, requireAdmin } from '@/server/admin-queries'
import { ChangesView, DemoWithoutDatabase, NotYours } from './changes-view'

/**
 * «Что меняли» — журнал изменений площадки.
 *
 * Здесь только данные и состояния. Оформление — в `changes-view.tsx`,
 * чтобы правки вида и правки логики не сталкивались в одном файле (§12).
 *
 * Права проверяются ЗДЕСЬ, а не в меню: меню решает, что показать, а не что
 * можно. Оператор, набравший этот адрес руками, получает отказ, а не экран.
 */
const PER_PAGE = 50

export default async function ChangesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  if (!isAvailable()) return <DemoWithoutDatabase />

  const access = await requireAdmin()
  if (!access.allowed) return <NotYours reason={access.reason} />

  const { page } = await searchParams
  const current = Math.max(Number(page ?? '1') || 1, 1)

  const changes = await changesPage({
    limit: PER_PAGE,
    offset: (current - 1) * PER_PAGE,
  })

  return <ChangesView page={changes} current={current} perPage={PER_PAGE} />
}

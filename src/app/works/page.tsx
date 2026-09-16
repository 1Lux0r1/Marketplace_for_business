import * as catalog from '@/modules/catalog'
import { contractorDeals, isAvailable } from '@/server/deal-queries'
import { requireUser } from '@/server/session'
import { DemoWithoutDatabase, NeedLogin, NotAContractor, Works } from './works-view'

/**
 * «Мои работы» у подрядчика: заказы, которые пришли ему.
 *
 * Здесь только данные и состояния. Оформление — в `works-view.tsx` (§12).
 *
 * Права: подрядчик видит заказы СВОЕЙ организации. Идентификатор подрядчика
 * берётся из его компании, а не из адреса — подставить чужой нечем.
 */
export default async function WorksPage() {
  if (!isAvailable()) return <DemoWithoutDatabase />

  const access = await requireUser()
  if (!access.allowed) return <NeedLogin />

  const contractor = await catalog.findContractorByOrg(access.user.orgId).catch(() => null)
  if (!contractor) return <NotAContractor />

  const page = await contractorDeals(access.user, contractor.id)
  return <Works page={page} status={contractor.status} />
}

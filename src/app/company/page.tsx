import { EmptyState } from '@/ui'
import {
  companyCard,
  isAvailable,
  personRows,
  requireUser,
  siteRows,
  zoneOptions,
} from '@/server/company-queries'
import { CompanyCabinet, DemoWithoutDatabase, NeedLogin } from './company-view'

/**
 * Кабинет клиента: компания, точки и доступ.
 *
 * Здесь только данные и состояния. Оформление — в `company-view.tsx`,
 * чтобы правки вида и правки логики не сталкивались в одном файле (§12).
 *
 * Раздел один, а не три: у владельца кофейни «Компания», «Объекты»
 * и «Сотрудники» — это одна мысль «моё хозяйство», и разносить её по трём
 * пунктам меню значит заставить его помнить, где что лежит (§7.1).
 */
export default async function CompanyPage() {
  if (!isAvailable()) return <DemoWithoutDatabase />

  const access = await requireUser()
  if (!access.allowed) return <NeedLogin />

  const [company, sites, people] = await Promise.all([
    companyCard(access.user),
    siteRows(access.user, { includeArchived: true }),
    personRows(access.user),
  ])

  if (!company) return <EmptyState title="Компания не найдена" description="Напишите нам, разберёмся." />

  return (
    <CompanyCabinet
      company={company}
      sites={sites}
      people={people}
      zones={zoneOptions()}
      canEdit={access.user.role === 'owner'}
    />
  )
}

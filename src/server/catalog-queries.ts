import 'server-only'
import * as catalog from '@/modules/catalog'
import * as platform from '@/modules/platform'
import { currentUser } from '@/server/session'

/**
 * Чтение для экранов оператора.
 *
 * Отдельно от команд формы: команды помечены как серверные действия и потому
 * вызываемы из браузера, а чтение вызывается только с сервера. Смешивать
 * их — лишняя поверхность без надобности.
 *
 * Права проверяются здесь, а не в разметке (§6): экран может отрисоваться
 * как угодно, но данные не должны уехать тому, кому не положено.
 */

export type OperatorAccess =
  | { allowed: true; user: platform.User }
  | { allowed: false; reason: 'anonymous' | 'forbidden' }

export async function requireOperator(): Promise<OperatorAccess> {
  const user = await currentUser()
  if (!user) return { allowed: false, reason: 'anonymous' }
  if (!platform.hasRole(user, 'operator')) return { allowed: false, reason: 'forbidden' }
  return { allowed: true, user }
}

/** Строка списка: подрядчик вместе с названием компании и его категориями. */
export type ContractorRow = {
  id: string
  orgName: string
  inn: string | null
  status: catalog.ContractorStatus
  manualRating: number | null
  categories: string[]
  zones: number
}

export async function contractorRows(filter: {
  status?: catalog.ContractorStatus | undefined
  categoryId?: string | undefined
}): Promise<ContractorRow[]> {
  const contractors = await catalog.listContractors(filter)

  // Название компании живёт в соседнем модуле, поэтому берётся его функцией,
  // а не соединением таблиц: между схемами JOIN запрещён (§4.2)
  return Promise.all(
    contractors.map(async (contractor) => {
      const card = await catalog.getContractor(contractor.id)
      const org = await platform.getOrg(contractor.orgId).catch(() => null)
      return {
        id: contractor.id,
        orgName: org?.name ?? 'Компания не найдена',
        inn: org?.inn ?? null,
        status: contractor.status,
        manualRating: contractor.manualRating,
        categories: card.categories.map((c) => c.name),
        zones: card.zones.length,
      }
    }),
  )
}

export type ContractorDetails = {
  card: catalog.ContractorCard
  orgName: string
  inn: string | null
  listings: catalog.Listing[]
}

export async function contractorDetails(id: string): Promise<ContractorDetails | null> {
  const card = await catalog.getContractor(id).catch(() => null)
  if (!card) return null

  const org = await platform.getOrg(card.orgId).catch(() => null)
  const listings = await catalog.listListings()

  return {
    card,
    orgName: org?.name ?? 'Компания не найдена',
    inn: org?.inn ?? null,
    listings: listings.filter((l) => l.contractorId === id),
  }
}

export async function categoryOptions(): Promise<catalog.Category[]> {
  return catalog.listCategories({ activeOnly: true })
}

export function zoneOptions(): catalog.Zone[] {
  return catalog.listZones()
}

/** Очередь оператора: кто зарегистрировался и ждёт ручной проверки ИНН. */
export type VerificationRow = {
  id: string
  orgName: string
  inn: string | null
  ownerName: string | null
  registeredAt: Date
  lookup: string | null
}

/**
 * Очередь — это «кого ещё не смотрел человек», а не «кто не активен».
 *
 * Отклонённый подрядчик остаётся черновиком: отказ — это не допуск в каталог,
 * а не блокировка. Но в очереди ему не место: иначе оператор каждое утро видит
 * одни и те же отказы и перестаёт отличать их от новых заявок. Решение
 * человека убирает строку; машинный вердикт — нет, машину человек и проверяет.
 *
 * Фильтр здесь, а не в `catalog`: отметка о проверке принадлежит компании,
 * то есть модулю `platform`, а соединять схемы запросом нельзя (§4).
 */
export async function verificationQueue(): Promise<VerificationRow[]> {
  const waiting = await catalog.pendingVerification()

  const rows = await Promise.all(
    waiting.map(async (contractor) => {
      const org = await platform.getOrg(contractor.orgId).catch(() => null)
      if (decidedByHuman(org?.innVerification)) return null

      const owner = await platform.findOrgOwner(contractor.orgId)
      return {
        id: contractor.id,
        orgName: org?.name ?? 'Компания не найдена',
        inn: org?.inn ?? null,
        ownerName: owner?.fullName ?? null,
        registeredAt: contractor.createdAt,
        // Почему справочник не помог — оператору это первое, что нужно знать
        lookup: readLookupStatus(org?.innVerification),
      }
    }),
  )

  return rows.filter((row): row is VerificationRow => row !== null)
}

/**
 * Метка решения человека. Живёт здесь одной строкой, потому что её ставит один
 * файл, а читает другой: разойдись они — очередь молча перестанет очищаться.
 */
export const MANUAL_VERDICT = 'manual'

function decidedByHuman(verification: unknown): boolean {
  if (typeof verification !== 'object' || verification === null) return false
  return (verification as { status?: unknown }).status === MANUAL_VERDICT
}

/**
 * Ответ справочника словами, а не кодом состояния. Оператор системные термины
 * знает (§7.1), но интерфейс всё равно на русском (§6): `unavailable` в
 * колонке — это то, что читают каждый день, и читать это должно быть легко.
 */
const LOOKUP_WORDS: Record<string, string> = {
  found: 'компания найдена',
  not_found: 'компании нет в реестре',
  bad_inn: 'номер не сходится',
  unavailable: 'не проверили',
  [MANUAL_VERDICT]: 'решение принято вручную',
}

function readLookupStatus(verification: unknown): string | null {
  if (typeof verification !== 'object' || verification === null) return null
  const record = verification as { status?: unknown; reason?: unknown }
  if (typeof record.status !== 'string') return null
  const words = LOOKUP_WORDS[record.status] ?? record.status
  return typeof record.reason === 'string' ? `${words} — ${record.reason}` : words
}

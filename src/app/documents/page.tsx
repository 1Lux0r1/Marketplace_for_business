import { clientDocument, clientDocuments, isAvailable } from '@/server/document-queries'
import { requireUser } from '@/server/session'
import { DemoWithoutDatabase, DocumentView, Documents, NeedLogin, NotYours } from './documents-view'

/**
 * «Документы и счета» у клиента.
 *
 * Здесь только данные и состояния. Оформление — в `documents-view.tsx` (§12).
 *
 * Документ открывается по `?id=`, а не отдельным адресом: демо собирается
 * без базы, и адрес с подставляемым куском там требует заранее перечислить
 * все номера. Тот же долг, что и у карточки услуги.
 */
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  if (!isAvailable()) return <DemoWithoutDatabase />

  const access = await requireUser()
  if (!access.allowed) return <NeedLogin />

  const { id } = await searchParams

  if (id) {
    const doc = await clientDocument(access.user, id)
    return doc ? <DocumentView doc={doc} /> : <NotYours />
  }

  return <Documents rows={await clientDocuments(access.user)} />
}

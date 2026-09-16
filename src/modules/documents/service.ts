import { and, desc, eq } from 'drizzle-orm'
import { getDb } from '@/shared/db'
import { uuidv7 } from '@/shared/id'
import * as platform from '@/modules/platform'
import { docs } from './schema'
import { nextNumber } from './numbering'
import { platformParty, render, type DocumentData, type LineItem } from './templates'
import { errors } from './errors'
import type { DocumentDoc, DocumentKind, SigningPath } from './types'

/**
 * Договор, счёт и акт: выпуск, подписание, чтение.
 *
 * Документ, однажды выпущенный, не меняется. Ошиблись — аннулируется
 * и выпускается новый, с новым номером. Правка выданного документа задним
 * числом это то, за что снимают лицензии, и отдельной команды для неё нет.
 */

/**
 * Выпустить документ.
 *
 * Номер и сам документ — ОДНА ТРАНЗАКЦИЯ: иначе номер уходит в пустоту
 * при любой ошибке, и в нумерации появляется пропуск (§8).
 */
export async function issue(input: {
  kind: DocumentKind
  dealId: string
  dealNumber: number
  clientOrgId: string
  contractorId?: string | undefined
  contractorName?: string | undefined
  signingPath: SigningPath
  items: LineItem[]
}): Promise<DocumentDoc> {
  if (input.items.length === 0) throw errors.bad('В документе нет ни одной позиции')

  // Реквизиты площадки — до всего остального: если их нет, документ
  // выпускать нельзя, и узнать об этом надо до того, как взят номер
  const platformSide = platformParty()

  const org = await platform.getOrg(input.clientOrgId)
  const total = input.items.reduce((sum, item) => sum + item.totalKopecks, 0n)
  const issuedAt = new Date()

  return getDb().transaction(async (tx) => {
    const number = await nextNumber(tx, input.kind, issuedAt)

    const data: DocumentData = {
      number,
      kind: input.kind,
      issuedAt,
      dealNumber: input.dealNumber,
      platform: platformSide,
      // Снимком: компанию переименуют, а выданный документ обязан остаться
      // тем, что подписали
      client: { name: org.name, inn: org.inn, kpp: org.kpp, address: org.legalAddress },
      contractorName: input.contractorName ?? null,
      items: input.items,
      totalKopecks: total,
      signingPath: input.signingPath,
    }

    const [row] = await tx
      .insert(docs)
      .values({
        id: uuidv7(),
        number,
        kind: input.kind,
        dealId: input.dealId,
        clientOrgId: input.clientOrgId,
        contractorId: input.contractorId ?? null,
        status: 'issued',
        signingPath: input.signingPath,
        amountKopecks: input.kind === 'contract' ? null : total,
        data: serialise(data),
        html: render(data),
        issuedAt,
      })
      .returning()

    return toDoc(row!)
  })
}

/**
 * Отметить документ подписанным.
 *
 * На БУМАЖНОМ пути это может сделать только оператор, сверив скан
 * (`docs/11-electronic-signature.md`). Иначе любая сторона отметила бы
 * подписание сама и открыла путь к выплате — то есть обошла бы гарант.
 *
 * На электронном пути отметку ставит система по ответу оператора ЭДО.
 * Оператор ЭДО пока не выбран (Q24), поэтому этот путь ждёт подключения,
 * и `signature` заполняется тем, что вернул проверяющий.
 */
export async function markSigned(input: {
  documentId: string
  byOperator: boolean
  signedBy: string
  signature: Record<string, unknown>
}): Promise<DocumentDoc> {
  const db = getDb()

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(docs)
      .where(eq(docs.id, input.documentId))
      .limit(1)
      .for('update')
    if (!row) throw errors.notFound()

    const current = toDoc(row)
    if (current.status === 'void') throw errors.voided()
    if (current.status === 'signed') throw errors.alreadySigned()
    if (current.signingPath === 'paper' && !input.byOperator) throw errors.needsOperator()

    const [updated] = await tx
      .update(docs)
      .set({
        status: 'signed',
        signedAt: new Date(),
        signedBy: input.signedBy,
        signature: input.signature,
      })
      .where(eq(docs.id, input.documentId))
      .returning()

    return toDoc(updated!)
  })
}

/**
 * Аннулировать документ. Подписанный аннулировать нельзя: он уже имеет силу,
 * и «передумали» здесь не работает — нужен новый документ, а не правка старого.
 */
export async function voidDocument(input: {
  documentId: string
  reason: string
}): Promise<DocumentDoc> {
  const reason = input.reason.trim()
  if (!reason) throw errors.bad('Напишите причину: её увидит вторая сторона')

  const db = getDb()
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(docs)
      .where(eq(docs.id, input.documentId))
      .limit(1)
      .for('update')
    if (!row) throw errors.notFound()
    if (row.status === 'signed') throw errors.alreadySigned()

    const [updated] = await tx
      .update(docs)
      .set({ status: 'void', voidedAt: new Date(), voidReason: reason })
      .where(eq(docs.id, input.documentId))
      .returning()

    return toDoc(updated!)
  })
}

export async function getDocument(documentId: string): Promise<DocumentDoc> {
  const [row] = await getDb().select().from(docs).where(eq(docs.id, documentId)).limit(1)
  if (!row) throw errors.notFound()
  return toDoc(row)
}

export async function listForDeal(dealId: string): Promise<DocumentDoc[]> {
  const rows = await getDb()
    .select()
    .from(docs)
    .where(eq(docs.dealId, dealId))
    .orderBy(docs.issuedAt)
  return rows.map(toDoc)
}

export async function listForClient(clientOrgId: string, limit = 50): Promise<DocumentDoc[]> {
  const rows = await getDb()
    .select()
    .from(docs)
    .where(eq(docs.clientOrgId, clientOrgId))
    .orderBy(desc(docs.issuedAt))
    .limit(limit)
  return rows.map(toDoc)
}

/** Есть ли по сделке подписанный акт. На этом держится разрешение выплаты (§8). */
export async function hasSignedAct(dealId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: docs.id })
    .from(docs)
    .where(and(eq(docs.dealId, dealId), eq(docs.kind, 'act'), eq(docs.status, 'signed')))
    .limit(1)
  return row !== undefined
}

// ─── Внутреннее ─────────────────────────────────────────────────────────

/** Копейки в JSON строкой: bigint туда не кладётся, а число теряет точность. */
function serialise(data: DocumentData): Record<string, unknown> {
  return {
    ...data,
    issuedAt: data.issuedAt.toISOString(),
    totalKopecks: data.totalKopecks.toString(),
    items: data.items.map((item) => ({
      ...item,
      priceKopecks: item.priceKopecks.toString(),
      totalKopecks: item.totalKopecks.toString(),
    })),
  }
}

type Row = typeof docs.$inferSelect

function toDoc(row: Row): DocumentDoc {
  return {
    id: row.id,
    number: row.number,
    kind: row.kind as DocumentKind,
    dealId: row.dealId,
    clientOrgId: row.clientOrgId,
    contractorId: row.contractorId,
    status: row.status as DocumentDoc['status'],
    signingPath: row.signingPath as SigningPath,
    amountKopecks: row.amountKopecks,
    data: (row.data as Record<string, unknown>) ?? {},
    html: row.html,
    issuedAt: row.issuedAt,
    signedAt: row.signedAt,
    signedBy: row.signedBy,
    signature: (row.signature as Record<string, unknown> | null) ?? null,
    voidedAt: row.voidedAt,
    voidReason: row.voidReason,
  }
}

import { and, eq, sql } from 'drizzle-orm'
import { getDb, type Executor } from '@/shared/db'
import { uuidv7 } from '@/shared/id'
import { normalizePhone } from '@/shared/phone'
import { orgs, users } from './schema'
import { errors } from './errors'
import type { LegalForm, Org, Role, User } from './types'

/** Компании и люди. Вход, сессии и пароли — в `auth.ts`. */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase()
}

/** Проверка формата — до записи в базу, чтобы не заводить лишнего. */
export function assertEmail(email: string): void {
  if (!EMAIL.test(normalizeEmail(email))) throw errors.badEmail()
}

export function assertPhone(phone: string): void {
  const normalized = normalizePhone(phone)
  if (!normalized.ok) throw errors.badPhone(normalized.error)
}

export async function createOrg(
  input: {
    legalForm: LegalForm
    name: string
    inn?: string | undefined
    isPlatform?: boolean | undefined
  },
  exec?: Executor,
): Promise<Org> {
  const db = exec ?? getDb()
  const id = uuidv7()

  try {
    const [row] = await db
      .insert(orgs)
      .values({
        id,
        legalForm: input.legalForm,
        name: input.name.trim(),
        inn: input.inn?.trim() || null,
        isPlatform: input.isPlatform ?? false,
        // Регистрация даёт роль заказчика. Роль подрядчика включается
        // отдельным действием — там проверка ИНН и договор с площадкой
        isClient: !(input.isPlatform ?? false),
      })
      .returning()
    return toOrg(row!)
  } catch (error: unknown) {
    if (isUniqueViolation(error, 'orgs_single_platform')) throw errors.platformOrgExists()
    if (isUniqueViolation(error, 'orgs_inn_key')) throw errors.innTaken()
    throw error
  }
}

export async function getOrg(id: string, exec?: Executor): Promise<Org> {
  const db = exec ?? getDb()
  const [row] = await db.select().from(orgs).where(eq(orgs.id, id)).limit(1)
  if (!row) throw errors.orgNotFound()
  return toOrg(row)
}

export async function getPlatformOrg(): Promise<Org | null> {
  const db = getDb()
  const [row] = await db.select().from(orgs).where(eq(orgs.isPlatform, true)).limit(1)
  return row ? toOrg(row) : null
}

/**
 * Включить роль подрядчика. Отдельное действие, а не флажок при регистрации:
 * выполнять работы нельзя, не пройдя проверку и не подписав договор.
 */
export async function enableContractorRole(orgId: string): Promise<Org> {
  const db = getDb()
  const [row] = await db
    .update(orgs)
    .set({ isContractor: true })
    .where(eq(orgs.id, orgId))
    .returning()
  if (!row) throw errors.orgNotFound()
  return toOrg(row)
}

export async function createUser(
  input: {
    orgId: string
    email: string
    phone: string
    fullName: string
    role: Role
    position?: string | undefined
  },
  exec?: Executor,
): Promise<User> {
  const db = exec ?? getDb()
  const email = normalizeEmail(input.email)
  assertEmail(email)

  const phone = normalizePhone(input.phone)
  if (!phone.ok) throw errors.badPhone(phone.error)

  // Организация должна существовать: между модулями внешних ключей нет,
  // а внутри своей схемы они есть — но проверить понятной ошибкой лучше здесь
  await getOrg(input.orgId, db)

  try {
    const [row] = await db
      .insert(users)
      .values({
        id: uuidv7(),
        orgId: input.orgId,
        email,
        phone: phone.phone,
        fullName: input.fullName.trim(),
        role: input.role,
        position: input.position?.trim() || null,
      })
      .returning()
    return toUser(row!)
  } catch (error: unknown) {
    if (isUniqueViolation(error, 'users_email_key')) throw errors.emailTaken()
    if (isUniqueViolation(error, 'users_phone_key')) throw errors.phoneTaken()
    throw error
  }
}

export async function getUser(id: string): Promise<User> {
  const db = getDb()
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!row) throw errors.userNotFound()
  return toUser(row)
}

export async function findUserByEmail(email: string, exec?: Executor): Promise<User | null> {
  const db = exec ?? getDb()
  const [row] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${normalizeEmail(email)}`)
    .limit(1)
  return row ? toUser(row) : null
}

/** Поиск по телефону — только среди подтверждённых: иначе чужой номер даёт вход. */
export async function findUserByVerifiedPhone(phone: string): Promise<User | null> {
  const normalized = normalizePhone(phone)
  if (!normalized.ok) return null

  const db = getDb()
  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.phone, normalized.phone), sql`${users.phoneVerifiedAt} is not null`))
    .limit(1)
  return row ? toUser(row) : null
}

/**
 * Найти человека по тому, что он ввёл в поле «почта или телефон».
 * Одно поле на два вида логина — так в шторке входа (docs/12-auth-ux.md).
 */
export async function findUserByLogin(login: string): Promise<User | null> {
  return login.includes('@')
    ? findUserByEmail(login)
    : findUserByVerifiedPhone(login)
}

export async function markEmailVerified(userId: string): Promise<void> {
  const db = getDb()
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId))
}

export async function markPhoneVerified(userId: string): Promise<void> {
  const db = getDb()
  try {
    await db.update(users).set({ phoneVerifiedAt: new Date() }).where(eq(users.id, userId))
  } catch (error: unknown) {
    if (isUniqueViolation(error, 'users_phone_key')) throw errors.phoneTaken()
    throw error
  }
}

/**
 * Права проверяются на сервере в каждой команде, а не в интерфейсе (§6).
 * Подрядчик не должен увидеть чужую сделку, даже подставив идентификатор в адрес.
 */
const ROLE_RANK: Record<Role, number> = { staff: 1, owner: 2, operator: 3, admin: 4 }

export function hasRole(user: Pick<User, 'role'>, required: Role): boolean {
  return ROLE_RANK[user.role] >= ROLE_RANK[required]
}

export function requireRole(user: Pick<User, 'role'>, required: Role): void {
  if (!hasRole(user, required)) throw errors.forbidden()
}

/** Принадлежность: чужая организация недоступна даже с верным идентификатором. */
export function requireSameOrg(user: Pick<User, 'orgId' | 'role'>, orgId: string): void {
  if (user.orgId === orgId) return
  // Сотрудники площадки видят чужие организации по роду работы
  if (hasRole(user, 'operator')) return
  throw errors.forbidden()
}

type OrgRow = typeof orgs.$inferSelect
type UserRow = typeof users.$inferSelect

function toOrg(row: OrgRow): Org {
  return {
    id: row.id,
    legalForm: row.legalForm as LegalForm,
    name: row.name,
    inn: row.inn,
    isClient: row.isClient,
    isContractor: row.isContractor,
    isPlatform: row.isPlatform,
    isActive: row.isActive,
    innVerifiedAt: row.innVerifiedAt,
  }
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    orgId: row.orgId,
    email: row.email,
    emailVerified: row.emailVerifiedAt !== null,
    phone: row.phone,
    phoneVerified: row.phoneVerifiedAt !== null,
    fullName: row.fullName,
    position: row.position,
    role: row.role as Role,
    isActive: row.isActive,
  }
}

/**
 * Нарушение уникальности по конкретному ограничению.
 *
 * Drizzle заворачивает ошибку драйвера в свою («Failed query: ...»), а код
 * и имя ограничения остаются во вложенной `cause`. Поэтому идём по цепочке.
 */
function isUniqueViolation(error: unknown, constraint: string): boolean {
  let current: unknown = error
  for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth += 1) {
    const e = current as { code?: string; constraint_name?: string; cause?: unknown }
    if (e.code === '23505' && e.constraint_name === constraint) return true
    current = e.cause
  }
  return false
}

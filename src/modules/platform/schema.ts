import { sql } from 'drizzle-orm'
import {
  bigserial,
  boolean,
  check,
  index,
  inet,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Схема `platform` — организации, пользователи, способы входа, сессии, роли.
 * Каждая таблица принадлежит ровно одному модулю (§4.1).
 *
 * `outbox` появится в задаче 01-3 вместе с воркером.
 */
export const platform = pgSchema('platform')

/**
 * Организация. Одна и та же компания может и заказывать, и выполнять —
 * поэтому два независимых признака вместо одного вида (решение от 05.09.2026).
 */
export const orgs = platform.table(
  'orgs',
  {
    id: uuid('id').primaryKey(),
    legalForm: text('legal_form').notNull(),
    isClient: boolean('is_client').notNull().default(true),
    isContractor: boolean('is_contractor').notNull().default(false),
    /** Служебная организация самой площадки: в ней живут operator и admin. */
    isPlatform: boolean('is_platform').notNull().default(false),
    name: text('name').notNull(),
    inn: text('inn'),
    kpp: text('kpp'),
    legalAddress: text('legal_address'),
    isActive: boolean('is_active').notNull().default(true),
    innVerifiedAt: timestamp('inn_verified_at', { withTimezone: true }),
    /** Ответ справочника целиком: через полгода надо уметь объяснить, почему пустили. */
    innVerification: jsonb('inn_verification'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('orgs_legal_form', sql`${t.legalForm} in ('individual','sole_trader','company')`),
    index('orgs_client_idx').on(t.isActive).where(sql`${t.isClient}`),
    index('orgs_contractor_idx').on(t.isActive).where(sql`${t.isContractor}`),
    uniqueIndex('orgs_inn_key').on(t.inn).where(sql`${t.inn} is not null`),
    /** Организация площадки ровно одна — это держит база, а не только код. */
    uniqueIndex('orgs_single_platform').on(t.isPlatform).where(sql`${t.isPlatform}`),
  ],
)

export const users = platform.table(
  'users',
  {
    id: uuid('id').primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    email: text('email').notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    /** Обязателен и может быть способом входа, поэтому в E.164 и с подтверждением. */
    phone: text('phone').notNull(),
    phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
    fullName: text('full_name').notNull(),
    /** Должность, а не права: директор, бухгалтер, менеджер (решение Q19.3). */
    position: text('position'),
    positionCheckedAt: timestamp('position_checked_at', { withTimezone: true }),
    positionCheck: jsonb('position_check'),
    role: text('role').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (t) => [
    check('users_role', sql`${t.role} in ('owner','staff','operator','admin')`),
    uniqueIndex('users_email_key').on(sql`lower(${t.email})`),
    /**
     * Уникальность телефона — только среди подтверждённых. Иначе достаточно
     * зарегистрироваться на чужой номер, чтобы настоящий владелец не смог.
     */
    uniqueIndex('users_phone_key').on(t.phone).where(sql`${t.phoneVerifiedAt} is not null`),
    index('users_org_idx').on(t.orgId),
  ],
)

/**
 * Способы входа. Отдельной таблицей, а не колонками в users: добавить вход
 * по Telegram или через партнёра станет строкой нового вида, а не изменением
 * структуры пользователей и не переносом данных.
 */
export const credentials = platform.table(
  'credentials',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    /** Пароль: медленный хэш. Для входа по ссылке секрета нет. */
    secretHash: text('secret_hash'),
    params: jsonb('params').notNull().default({}),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => [
    check('credentials_kind', sql`${t.kind} in ('password','email_link')`),
    uniqueIndex('credentials_user_kind_key').on(t.userId, t.kind).where(sql`${t.isActive}`),
  ],
)

/**
 * Одноразовые ссылки и коды: вход, подтверждение почты, установка
 * и восстановление пароля. Одна таблица с назначением вместо четырёх одинаковых.
 */
export const loginTokens = platform.table(
  'login_tokens',
  {
    id: uuid('id').primaryKey(),
    email: text('email').notNull(),
    purpose: text('purpose').notNull().default('login'),
    tokenHash: text('token_hash').notNull(),
    /** Сколько раз пробовали ввести код. Защита от перебора шести цифр. */
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'login_tokens_purpose',
      sql`${t.purpose} in ('login','verify_email','set_password','reset_password')`,
    ),
    uniqueIndex('login_tokens_hash_key').on(t.tokenHash),
    index('login_tokens_email_idx').on(sql`lower(${t.email})`, t.purpose, t.createdAt.desc()),
  ],
)

export const sessions = platform.table(
  'sessions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ip: inet('ip'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sessions_hash_key').on(t.tokenHash),
    index('sessions_user_idx').on(t.userId),
  ],
)

/**
 * Журнал попыток входа. По нему считаются ограничения частоты: и «не больше
 * трёх писем на адрес за 15 минут», и «после пяти неверных паролей подряд
 * вход приостанавливается». Отдельного хранилища для счётчиков не заводим (§3).
 */
export const loginAttempts = platform.table(
  'login_attempts',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    email: text('email').notNull(),
    ip: inet('ip'),
    method: text('method').notNull(),
    succeeded: boolean('succeeded').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('login_attempts_method', sql`${t.method} in ('password','email_link','code')`),
    index('login_attempts_email_idx').on(sql`lower(${t.email})`, t.at.desc()),
    index('login_attempts_ip_idx').on(t.ip, t.at.desc()),
  ],
)

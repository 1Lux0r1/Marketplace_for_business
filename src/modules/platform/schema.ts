import { pgSchema } from 'drizzle-orm/pg-core'

/**
 * Схема `platform` — организации, пользователи, сессии, роли, outbox.
 * Каждая таблица принадлежит ровно одному модулю, схема названа именем модуля (§4.1).
 *
 * Таблицы появятся в задачах 01-2 (orgs, users, login_tokens, sessions)
 * и 01-3 (outbox). Здесь пока только объявление самой схемы, чтобы миграции
 * ложились в неё с первого дня, а не переезжали потом из public.
 */
export const platform = pgSchema('platform')

/**
 * Публичный интерфейс модуля `platform`.
 *
 * ЕДИНСТВЕННОЕ, что видят соседи (§4.4). Здесь только команды, запросы и типы
 * событий; `service.ts` и `schema.ts` наружу не выставляются — это проверяет линтер.
 *
 * Наполняется в 01-2 (getOrg, getUser, createOrg, inviteUser, startLogin,
 * completeLogin, getSession, logout) и 01-3 (publish, on).
 */

/** Роли пользователей площадки. */
export type Role = 'owner' | 'staff' | 'operator' | 'admin'

/** Вид организации: и клиент, и подрядчик — это org с разным kind (docs/04-glossary.md). */
export type OrgKind = 'client' | 'contractor'

export {}

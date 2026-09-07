import * as service from './service'
import * as zones from './zones'

/**
 * Публичный интерфейс модуля `catalog`.
 *
 * ЕДИНСТВЕННОЕ, что видят соседи (§4.4). Внутрь — `service.ts`, `schema.ts`,
 * `zones.ts` — снаружи ходить нельзя, это проверяет линтер.
 *
 * Модуль ничего не знает про сделки, заявки и оплату: он отвечает на вопросы
 * «что продаётся», «кем» и «где», и на этом его ответственность кончается.
 */

export type {
  Category,
  CategoryKind,
  Contractor,
  ContractorCard,
  ContractorStatus,
  Listing,
  ListingStatus,
  SearchResult,
  StorefrontListing,
  Zone,
  ZoneKind,
} from './types'
export { CatalogError } from './errors'
export type { CatalogErrorCode } from './errors'

// ─── Категории ──────────────────────────────────────────────────────────

export const listCategories = service.listCategories
export const getCategory = service.getCategory
export const getCategoryByCode = service.getCategoryByCode

// ─── Зоны ───────────────────────────────────────────────────────────────

/** Единственный источник кодов зон: руками их не вводит никто. */
export const listZones = zones.listZones
export const findZone = zones.findZone
export const isKnownZone = zones.isKnownZone

// ─── Подрядчики ─────────────────────────────────────────────────────────

export const createContractor = service.createContractor
export const getContractor = service.getContractor
export const findContractorByOrg = service.findContractorByOrg
export const listContractors = service.listContractors
export const setContractorStatus = service.setContractorStatus
export const setContractorCategories = service.setContractorCategories
export const setContractorZones = service.setContractorZones

/**
 * Кого позвать на заявку. Запасной путь для ИИ-сервиса: когда он молчит
 * или отвечает неуверенно, отбор идёт по этим правилам.
 */
export const findCandidates = service.findCandidates

// ─── Карточки каталога ──────────────────────────────────────────────────

export const createListing = service.createListing
export const listListings = service.listListings

// ─── Витрина ────────────────────────────────────────────────────────────

/** Поиск по витрине. Видны только опубликованные карточки. */
export const searchListings = service.searchListings
export const getStorefrontListing = service.getStorefrontListing

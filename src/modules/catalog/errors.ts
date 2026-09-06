/**
 * Ошибки модуля. У каждой есть текст для человека — без извинений,
 * без «произошла ошибка», без кодов без объяснения (§7.4).
 */
export class CatalogError extends Error {
  constructor(
    readonly code: CatalogErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'CatalogError'
  }
}

export type CatalogErrorCode =
  | 'category_not_found'
  | 'contractor_not_found'
  | 'listing_not_found'
  | 'org_not_found'
  | 'org_already_contractor'
  | 'unknown_zone'
  | 'zone_not_covered'
  | 'bad_price'

export const errors = {
  categoryNotFound: () => new CatalogError('category_not_found', 'Категория не найдена'),
  contractorNotFound: () => new CatalogError('contractor_not_found', 'Подрядчик не найден'),
  listingNotFound: () => new CatalogError('listing_not_found', 'Карточка не найдена'),
  orgNotFound: () =>
    new CatalogError(
      'org_not_found',
      'Такой компании нет в системе. Сначала она должна зарегистрироваться.',
    ),
  orgAlreadyContractor: () =>
    new CatalogError('org_already_contractor', 'Эта компания уже заведена как подрядчик'),
  unknownZone: (code: string) =>
    new CatalogError('unknown_zone', `Зоны «${code}» не существует. Выберите из списка.`),
  zoneNotCovered: (code: string) =>
    new CatalogError(
      'zone_not_covered',
      `Подрядчик не работает в зоне «${code}». Сначала добавьте её ему.`,
    ),
  badPrice: () => new CatalogError('bad_price', 'Цена должна быть больше нуля'),
}

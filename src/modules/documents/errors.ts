/**
 * Ошибки модуля. У каждой есть текст для человека — без извинений,
 * без «произошла ошибка», без кодов без объяснения (§7.4).
 */
export class DocumentError extends Error {
  constructor(
    readonly code: DocumentErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'DocumentError'
  }
}

export type DocumentErrorCode =
  | 'document_not_found'
  | 'no_platform_details'
  | 'already_signed'
  | 'voided'
  | 'needs_operator'
  | 'bad_document'

export const errors = {
  notFound: () => new DocumentError('document_not_found', 'Такого документа нет'),

  /**
   * Реквизиты площадки не выдуманы и не подставлены по умолчанию (§9.7):
   * документ с ненастоящим ИНН хуже, чем отсутствие документа.
   */
  noPlatformDetails: () =>
    new DocumentError(
      'no_platform_details',
      'Не заполнены реквизиты площадки: без них счёт и акт выпускать нельзя. Заполните их в настройках.',
    ),

  alreadySigned: () => new DocumentError('already_signed', 'Этот документ уже подписан'),
  voided: () => new DocumentError('voided', 'Этот документ аннулирован'),
  needsOperator: () =>
    new DocumentError(
      'needs_operator',
      'Документ, подписанный на бумаге, отмечает наш сотрудник — сверив скан. Загрузите скан, мы проверим.',
    ),
  bad: (why: string) => new DocumentError('bad_document', why),
}

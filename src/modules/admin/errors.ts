/**
 * Ошибки модуля. У каждой есть текст для человека — без извинений,
 * без «произошла ошибка», без кодов без объяснения (§7.4).
 */
export class AdminError extends Error {
  constructor(
    readonly code: AdminErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'AdminError'
  }
}

export type AdminErrorCode = 'change_not_found' | 'bad_change'

export const errors = {
  changeNotFound: () => new AdminError('change_not_found', 'Такой записи в журнале нет'),
  badChange: (why: string) => new AdminError('bad_change', why),
}

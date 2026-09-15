/**
 * Ошибки модуля. У каждой есть текст для человека — без извинений,
 * без «произошла ошибка», без кодов без объяснения (§7.4).
 */
export class IntakeError extends Error {
  constructor(
    readonly code: IntakeErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'IntakeError'
  }
}

export type IntakeErrorCode = 'request_not_found' | 'bad_request' | 'forbidden'

export const errors = {
  requestNotFound: () => new IntakeError('request_not_found', 'Такой заявки нет'),
  badRequest: (why: string) => new IntakeError('bad_request', why),
  forbidden: () => new IntakeError('forbidden', 'Эта заявка не вашей компании'),
}

/**
 * Ошибки модуля. У каждой есть текст для человека — без извинений,
 * без «произошла ошибка», без кодов без объяснения (§7.4).
 *
 * Отдельный класс нужен, чтобы отличить «пользователь сделал не так»
 * от «у нас сломалось»: первое показываем, второе логируем и показываем
 * общее сообщение.
 */
export class PlatformError extends Error {
  constructor(
    readonly code: PlatformErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'PlatformError'
  }
}

export type PlatformErrorCode =
  | 'org_not_found'
  | 'user_not_found'
  | 'email_taken'
  | 'inn_taken'
  | 'phone_taken'
  | 'weak_password'
  | 'bad_phone'
  | 'bad_email'
  | 'token_expired'
  | 'token_used'
  | 'token_unknown'
  | 'too_many_attempts'
  | 'wrong_credentials'
  | 'not_verified'
  | 'forbidden'
  | 'platform_org_exists'

export const errors = {
  orgNotFound: () => new PlatformError('org_not_found', 'Компания не найдена'),
  userNotFound: () => new PlatformError('user_not_found', 'Пользователь не найден'),
  emailTaken: () =>
    new PlatformError('email_taken', 'На этот адрес уже есть учётная запись. Попробуйте войти.'),
  phoneTaken: () =>
    new PlatformError('phone_taken', 'Этот номер уже подтверждён другой учётной записью'),
  innTaken: () =>
    new PlatformError(
      'inn_taken',
      'Компания с таким ИНН уже зарегистрирована. Попросите её владельца пригласить вас.',
    ),
  weakPassword: (why: string) => new PlatformError('weak_password', why),
  badPhone: (why: string) => new PlatformError('bad_phone', why),
  badEmail: () => new PlatformError('bad_email', 'Проверьте адрес почты: похоже, в нём опечатка'),
  tokenExpired: () =>
    new PlatformError('token_expired', 'Срок ссылки истёк. Запросите новую — это займёт минуту.'),
  tokenUsed: () =>
    new PlatformError('token_used', 'Этой ссылкой уже воспользовались. Запросите новую.'),
  tokenUnknown: () =>
    new PlatformError('token_unknown', 'Ссылка не подходит. Проверьте, что скопировали её целиком.'),
  tooManyAttempts: (minutes: number) =>
    new PlatformError(
      'too_many_attempts',
      `Слишком много попыток. Попробуйте снова через ${minutes} мин.`,
    ),
  wrongCredentials: () =>
    new PlatformError('wrong_credentials', 'Не подходит логин или пароль'),
  notVerified: () =>
    new PlatformError('not_verified', 'Учётная запись не активирована. Введите код из письма.'),
  forbidden: () => new PlatformError('forbidden', 'Недостаточно прав для этого действия'),
  platformOrgExists: () =>
    new PlatformError('platform_org_exists', 'Организация площадки уже заведена'),
} as const

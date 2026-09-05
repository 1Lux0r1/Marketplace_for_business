import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

/**
 * Одноразовые ссылки и коды подтверждения.
 *
 * Ссылка — 32 случайных байта. Перебрать её нельзя, поэтому хранится быстрым
 * отпечатком: медленный хэш тут ничего не добавит, а вход замедлит.
 *
 * Код из письма — шесть цифр, и это ровно миллион вариантов. Быстрый отпечаток
 * от шести цифр раскрывается перебором мгновенно, поэтому код хранится
 * медленным хэшем (`password.ts`) — как пароль.
 */

/** Секрет для ссылки: 32 случайных байта в виде строки для адреса. */
export function createLinkToken(): string {
  return randomBytes(32).toString('base64url')
}

/** Быстрый отпечаток длинного случайного токена. */
export function hashLinkToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function linkTokenMatches(token: string, storedHash: string): boolean {
  const actual = Buffer.from(hashLinkToken(token), 'hex')
  const expected = Buffer.from(storedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export const CODE_LENGTH = 6

/**
 * Код подтверждения из письма. Только цифры: его переписывают руками
 * с экрана почты, а буквы в этом месте порождают путаницу «O или ноль».
 */
export function createConfirmationCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i += 1) code += String(randomInt(0, 10))
  return code
}

/** Приводит введённый код к виду для сравнения: люди вставляют пробелы и дефисы. */
export function normalizeCode(input: string): string {
  return input.replace(/\D/gu, '')
}

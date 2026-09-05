import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import type { ScryptOptions } from 'node:crypto'
import { promisify } from 'node:util'

// promisify теряет перегрузку с параметрами, поэтому тип задаём явно
const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>

/**
 * Медленный хэш для паролей и коротких кодов подтверждения.
 *
 * Медленный — это его смысл, а не недостаток: если базу украдут, перебор
 * по ней должен быть неподъёмным. Для длинных случайных токенов (ссылки входа)
 * он не нужен — там перебирать нечего, см. `token.ts`.
 *
 * Берём scrypt из стандартной библиотеки Node, а не отдельный пакет:
 * это функция, специально предназначенная для паролей, и она не добавляет
 * зависимости, которую сопровождать семь месяцев (§3).
 *
 * Формат хранения самоописывающийся: `scrypt$N$r$p$соль$хэш`. Когда параметры
 * придётся усилить, старые записи останутся проверяемыми, а новые начнут
 * писаться с новыми параметрами — без переноса данных.
 */

export const SCRYPT_PARAMS = { N: 16_384, r: 8, p: 1, keylen: 64 } as const

// scrypt требует 128 * N * r байт; при N=16384, r=8 это 16 МБ.
// Умолчание Node — 32 МБ, но задаём явно, чтобы усиление параметров
// не упёрлось молча в лимит
const MAXMEM = 64 * 1024 * 1024

export async function hashSecret(secret: string): Promise<string> {
  const { N, r, p, keylen } = SCRYPT_PARAMS
  const salt = randomBytes(16)
  const derived = await scrypt(secret.normalize('NFKC'), salt, keylen, {
    N,
    r,
    p,
    maxmem: MAXMEM,
  })
  return ['scrypt', N, r, p, salt.toString('base64'), derived.toString('base64')].join('$')
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false

  const N = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false

  const salt = Buffer.from(parts[4]!, 'base64')
  const expected = Buffer.from(parts[5]!, 'base64')
  if (salt.length === 0 || expected.length === 0) return false

  let derived: Buffer
  try {
    derived = await scrypt(secret.normalize('NFKC'), salt, expected.length, {
      N,
      r,
      p,
      maxmem: MAXMEM,
    })
  } catch {
    // Параметры из базы могут оказаться невалидными — это не повод падать,
    // это повод не пустить
    return false
  }

  // Сравнение за постоянное время: обычное сравнение выдаёт длину совпадения
  // по времени ответа
  return derived.length === expected.length && timingSafeEqual(derived, expected)
}

/** Пароль, который система принимает. Требований к составу нет — они делают пароли хуже. */
export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_MAX_LENGTH = 200

export function checkPasswordStrength(password: string): string | null {
  const value = password.normalize('NFKC')
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Пароль короче ${PASSWORD_MIN_LENGTH} символов. Длина надёжнее сложности: возьмите несколько слов.`
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    return `Пароль длиннее ${PASSWORD_MAX_LENGTH} символов.`
  }
  if (/^(.)\1+$/u.test(value)) {
    return 'Пароль из одного повторяющегося символа подбирается мгновенно.'
  }
  return null
}

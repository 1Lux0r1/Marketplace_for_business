import { describe, expect, it } from 'vitest'
import {
  hashSecret,
  verifySecret,
  checkPasswordStrength,
  PASSWORD_MIN_LENGTH,
} from './password'

/** Пароли — это доступ к чужим деньгам, поэтому тесты обязательны (§8). */

describe('хранение пароля', () => {
  it('не хранит пароль в открытом виде', async () => {
    const stored = await hashSecret('очень секретный пароль')
    expect(stored).not.toContain('очень секретный пароль')
    expect(stored).not.toContain('секретный')
  })

  it('принимает верный пароль и отклоняет неверный', async () => {
    const stored = await hashSecret('правильный пароль')
    await expect(verifySecret('правильный пароль', stored)).resolves.toBe(true)
    await expect(verifySecret('неправильный пароль', stored)).resolves.toBe(false)
  })

  it('на один и тот же пароль даёт разные записи', async () => {
    // Иначе по базе видно, у кого пароли совпадают
    const a = await hashSecret('одинаковый')
    const b = await hashSecret('одинаковый')
    expect(a).not.toBe(b)
    await expect(verifySecret('одинаковый', a)).resolves.toBe(true)
    await expect(verifySecret('одинаковый', b)).resolves.toBe(true)
  })

  it('запись самоописывающаяся: по ней видно алгоритм и параметры', async () => {
    const stored = await hashSecret('пароль подлиннее')
    expect(stored.split('$').slice(0, 4)).toEqual(['scrypt', '16384', '8', '1'])
  })

  it('не падает на испорченной записи из базы, а просто не пускает', async () => {
    for (const broken of ['', 'мусор', 'scrypt$1$2$3', 'scrypt$x$y$z$q$w', 'bcrypt$1$2$3$4$5']) {
      await expect(verifySecret('пароль', broken)).resolves.toBe(false)
    }
  })

  it('различает пароли, отличающиеся только регистром и пробелом', async () => {
    const stored = await hashSecret('Пароль Мой')
    await expect(verifySecret('пароль мой', stored)).resolves.toBe(false)
    await expect(verifySecret('Пароль  Мой', stored)).resolves.toBe(false)
  })
})

describe('требования к паролю', () => {
  it('пропускает длинный пароль без спецсимволов', () => {
    expect(checkPasswordStrength('корова лошадь батарейка')).toBeNull()
  })

  it('отклоняет слишком короткий', () => {
    expect(checkPasswordStrength('коротко')).toContain(String(PASSWORD_MIN_LENGTH))
  })

  it('отклоняет один повторяющийся символ', () => {
    expect(checkPasswordStrength('аааааааааааа')).not.toBeNull()
  })

  it('не требует заглавных и спецсимволов', () => {
    // Такие требования делают пароли предсказуемее, а не надёжнее
    expect(checkPasswordStrength('простые слова тут')).toBeNull()
  })
})

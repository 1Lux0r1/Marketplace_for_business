import { describe, expect, it } from 'vitest'
import {
  createLinkToken,
  hashLinkToken,
  linkTokenMatches,
  createConfirmationCode,
  normalizeCode,
  CODE_LENGTH,
} from './token'

describe('ссылка входа', () => {
  it('не повторяется', () => {
    const tokens = new Set(Array.from({ length: 2000 }, () => createLinkToken()))
    expect(tokens.size).toBe(2000)
  })

  it('в базе лежит отпечаток, а не сам токен', () => {
    const token = createLinkToken()
    const stored = hashLinkToken(token)
    expect(stored).not.toContain(token)
    expect(stored).toMatch(/^[0-9a-f]{64}$/)
  })

  it('свой токен подходит, чужой нет', () => {
    const token = createLinkToken()
    const stored = hashLinkToken(token)
    expect(linkTokenMatches(token, stored)).toBe(true)
    expect(linkTokenMatches(createLinkToken(), stored)).toBe(false)
  })

  it('не падает на испорченном отпечатке', () => {
    expect(linkTokenMatches(createLinkToken(), 'мусор')).toBe(false)
    expect(linkTokenMatches(createLinkToken(), '')).toBe(false)
  })
})

describe('код подтверждения', () => {
  it('состоит только из цифр нужной длины', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(createConfirmationCode()).toMatch(new RegExp(`^\\d{${CODE_LENGTH}}$`))
    }
  })

  it('использует все цифры, а не подмножество', () => {
    const seen = new Set(Array.from({ length: 500 }, () => createConfirmationCode()).join(''))
    expect(seen.size).toBe(10)
  })

  it('терпит пробелы и дефисы при вводе', () => {
    expect(normalizeCode('123 456')).toBe('123456')
    expect(normalizeCode('123-456')).toBe('123456')
    expect(normalizeCode(' 1 2 3 4 5 6 ')).toBe('123456')
  })
})

import { describe, expect, it } from 'vitest'
import { uuidv7, isUuidV7 } from './id'

describe('uuidv7', () => {
  it('выдаёт формат UUID версии 7', () => {
    for (let i = 0; i < 100; i += 1) expect(isUuidV7(uuidv7())).toBe(true)
  })

  it('сортируется по времени', () => {
    const early = uuidv7(1_700_000_000_000)
    const late = uuidv7(1_700_000_001_000)
    expect(early < late).toBe(true)
  })

  it('сохраняет порядок внутри одной миллисекунды', () => {
    const now = Date.now()
    const ids = Array.from({ length: 50 }, () => uuidv7(now))
    expect([...ids].sort()).toEqual(ids)
  })

  it('не повторяется', () => {
    const ids = new Set(Array.from({ length: 5_000 }, () => uuidv7()))
    expect(ids.size).toBe(5_000)
  })

  it('не принимает чужой формат', () => {
    expect(isUuidV7('00000000-0000-4000-8000-000000000000')).toBe(false)
    expect(isUuidV7('не uuid')).toBe(false)
  })
})

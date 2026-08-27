/**
 * UUID v7 — сортируемый по времени (§6 CLAUDE.md). Генерируется в коде, не в базе.
 *
 * Своя реализация вместо зависимости: двадцать строк против пакета, который
 * придётся сопровождать семь месяцев (§3). Формат по RFC 9562:
 * 48 бит миллисекунд Unix, 4 бита версии, 12 бит счётчика, 2 бита варианта,
 * 62 бита случайности.
 *
 * Счётчик нужен, чтобы два вызова внутри одной миллисекунды сохраняли порядок:
 * без него сортировка по идентификатору внутри миллисекунды случайна.
 */

let lastMs = -1
let counter = 0

export function uuidv7(now: number = Date.now()): string {
  if (now === lastMs) {
    counter = (counter + 1) & 0xfff
    // Счётчик переполнился внутри миллисекунды — ждём следующую, чтобы не сломать порядок
    if (counter === 0) return uuidv7(now + 1)
  } else {
    lastMs = now
    counter = 0
  }

  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)

  const ms = BigInt(now)
  bytes[0] = Number((ms >> 40n) & 0xffn)
  bytes[1] = Number((ms >> 32n) & 0xffn)
  bytes[2] = Number((ms >> 24n) & 0xffn)
  bytes[3] = Number((ms >> 16n) & 0xffn)
  bytes[4] = Number((ms >> 8n) & 0xffn)
  bytes[5] = Number(ms & 0xffn)

  bytes[6] = 0x70 | ((counter >> 8) & 0x0f)
  bytes[7] = counter & 0xff
  bytes[8] = 0x80 | (bytes[8]! & 0x3f)

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export function isUuidV7(value: string): boolean {
  return UUID_V7.test(value)
}

import { Writable } from 'node:stream'
import { pino, destination, type Logger } from 'pino'
import { config } from './config'

/**
 * Структурные логи (§3). В разработке — в stdout, в проде — в файл из LOG_FILE,
 * ротация внешняя (logrotate), а не пакетом.
 *
 * В каждой строке должен быть `requestId`, а где есть сделка — `dealId`.
 * Для этого пользуйтесь `child()`, а не глобальным логгером напрямую.
 *
 * Персональные данные в логи не пишем: §8, они не должны уезжать за пределы РФ
 * даже через сервис ошибок. Телефоны, адреса и почты — только идентификаторы.
 *
 * Формат зависит от того, куда пишем. В файл — JSON, его читают программы.
 * На экран — человеческие строки: за окном запуска на своей машине следит
 * человек, а не программа, и сплошной JSON он читать не станет.
 */

let root: Logger | undefined

export function logger(): Logger {
  if (root) return root
  const cfg = config()
  root = cfg.LOG_FILE
    ? pino({ level: cfg.LOG_LEVEL }, destination({ dest: cfg.LOG_FILE, sync: false }))
    : pino({ level: cfg.LOG_LEVEL }, humanReadable())
  return root
}

export function childLogger(bindings: Record<string, unknown>): Logger {
  return logger().child(bindings)
}

/** Сбросить логгер — для тестов, которые меняют настройки. */
export function resetLogger(): void {
  root = undefined
}

// ─── Человеческий вывод ─────────────────────────────────────────────────

const LEVELS: Record<number, string> = {
  10: 'подробно',
  20: 'отладка',
  30: 'инфо',
  40: 'внимание',
  50: 'ошибка',
  60: 'сбой',
}

// Цвет только в настоящем терминале: при перенаправлении в файл эти
// последовательности превратились бы в мусор посреди текста
const COLORS: Record<number, string> = { 40: '[33m', 50: '[31m', 60: '[31m' }
const DIM = '[90m'
const RESET = '[0m'

/** Служебные поля pino: в человеческом выводе они только мешают. */
const HIDDEN = new Set(['level', 'time', 'msg', 'pid', 'hostname', 'v'])

function humanReadable(): Writable {
  let tail = ''
  return new Writable({
    write(chunk: Buffer, _encoding, done) {
      // Поток может разрезать строку посередине — остаток дописываем к следующему куску
      const text = tail + chunk.toString('utf8')
      const lines = text.split('\n')
      tail = lines.pop() ?? ''
      for (const line of lines) {
        if (line.trim()) process.stdout.write(`${format(line)}\n`)
      }
      done()
    },
  })
}

/** Экспортируется ради теста: от этого вывода зависит поиск кода из письма. */
export function format(line: string): string {
  let entry: Record<string, unknown>
  try {
    entry = JSON.parse(line) as Record<string, unknown>
  } catch {
    // Не наша строка — отдаём как есть, глотать вывод нельзя
    return line
  }

  const color = paint(typeof entry.level === 'number' ? entry.level : 30)
  const level = LEVELS[typeof entry.level === 'number' ? entry.level : 30] ?? 'инфо'
  const head = `${dim(clock(entry.time))} ${color(level.padEnd(8))} ${String(entry.msg ?? '')}`

  // Длинные многострочные значения (текст письма) — блоком под строкой,
  // иначе код подтверждения не найти глазами
  const blocks: string[] = []
  const pairs: string[] = []

  for (const [key, value] of Object.entries(entry)) {
    if (HIDDEN.has(key)) continue
    if (typeof value === 'string' && value.includes('\n')) {
      blocks.push(`${dim(`  ${key}:`)}\n${value.replace(/^/gmu, '    ')}`)
    } else {
      pairs.push(`${dim(`${key}=`)}${short(value)}`)
    }
  }

  return [pairs.length ? `${head}  ${pairs.join(' ')}` : head, ...blocks].join('\n')
}

function paint(level: number): (text: string) => string {
  const code = COLORS[level]
  return code && process.stdout.isTTY ? (text) => `${code}${text}${RESET}` : (text) => text
}

function dim(text: string): string {
  return process.stdout.isTTY ? `${DIM}${text}${RESET}` : text
}

function clock(time: unknown): string {
  const date = typeof time === 'number' ? new Date(time) : new Date()
  return date.toTimeString().slice(0, 8)
}

function short(value: unknown): string {
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.message
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

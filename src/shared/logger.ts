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
 */

let root: Logger | undefined

export function logger(): Logger {
  if (root) return root
  const cfg = config()
  root = cfg.LOG_FILE
    ? pino({ level: cfg.LOG_LEVEL }, destination({ dest: cfg.LOG_FILE, sync: false }))
    : pino({ level: cfg.LOG_LEVEL })
  return root
}

export function childLogger(bindings: Record<string, unknown>): Logger {
  return logger().child(bindings)
}

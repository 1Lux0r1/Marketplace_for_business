import { z } from 'zod'

/**
 * Конфигурация приложения.
 *
 * Приложение падает на старте с понятной ошибкой, если переменной не хватает —
 * это специально (см. `.env.example`). Лучше не подняться на деплое, чем подняться
 * и отдавать пятисотые из середины сделки.
 *
 * Разбор ленивый: импорт модуля ничего не читает, чтобы `next build` не требовал
 * заполненного окружения. Первый вызов `config()` на старте сервера — требует.
 */

const bool = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.url(),
  APP_NAME: z.string().min(1),
  SESSION_SECRET: z
    .string()
    .min(32, 'нужно минимум 32 байта: openssl rand -base64 48'),

  DATABASE_URL: z.string().min(1),
  DATABASE_URL_TEST: z.string().min(1).optional(),

  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  WORKER_BATCH_SIZE: z.coerce.number().int().positive().max(500).default(50),
  WORKER_MAX_ATTEMPTS: z.coerce.number().int().positive().default(10),

  MAIL_TRANSPORT: z.enum(['log', 'smtp']).default('log'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_FILE: z.string().optional(),

  AI_SERVICE_URL: z.url().optional(),
  AI_SERVICE_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
  AI_SERVICE_ENABLED: bool.default(false),

  COMMISSION_RATE_SERVICES: z.coerce.number().gt(0).lt(1).default(0.13),
  COMMISSION_RATE_GOODS: z.coerce.number().gt(0).lt(1).default(0.07),
})
  // Почта по SMTP без адреса сервера — это тихо не работающие письма.
  .refine((c) => c.MAIL_TRANSPORT !== 'smtp' || Boolean(c.SMTP_HOST), {
    path: ['SMTP_HOST'],
    message: 'при MAIL_TRANSPORT=smtp обязателен',
  })

export type Config = z.infer<typeof schema>

let cached: Config | undefined

/** Источник значений: process.env или любой такой же словарь — так тестам не нужен глобал. */
export type EnvSource = Record<string, string | undefined>

export function config(env: EnvSource = process.env): Config {
  if (cached) return cached
  cached = parseConfig(env)
  return cached
}

/** Разбор без кеша — для тестов и для проверки окружения на деплое. */
export function parseConfig(env: EnvSource): Config {
  const result = schema.safeParse(env)
  if (result.success) return result.data
  throw new ConfigError(result.error.issues.map(describe))
}

function describe(issue: { path: PropertyKey[]; message: string }): string {
  const name = issue.path.join('.') || '(корень)'
  return `  ${name}: ${issue.message}`
}

export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(
      `Не хватает переменных окружения или они заполнены неверно:\n${problems.join('\n')}\n\n` +
        'Скопируйте .env.example в .env и заполните. Приложение не стартует специально.',
    )
    this.name = 'ConfigError'
  }
}

/** Сброс кеша между тестами. */
export function resetConfigCache(): void {
  cached = undefined
}

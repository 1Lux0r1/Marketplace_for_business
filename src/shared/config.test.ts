import { describe, expect, it } from 'vitest'
import { parseConfig, ConfigError, type EnvSource } from './config'

const minimal = {
  APP_URL: 'http://localhost:3000',
  APP_NAME: 'marketplace-for-business',
  SESSION_SECRET: 'x'.repeat(32),
  DATABASE_URL: 'postgres://user:pass@localhost:5432/marketplace',
} satisfies EnvSource

describe('config', () => {
  it('поднимается на минимальном наборе переменных', () => {
    const cfg = parseConfig({ ...minimal })
    expect(cfg.APP_NAME).toBe('marketplace-for-business')
    expect(cfg.WORKER_POLL_INTERVAL_MS).toBe(5000)
    expect(cfg.MAIL_TRANSPORT).toBe('log')
    expect(cfg.AI_SERVICE_ENABLED).toBe(false)
  })

  it('падает с понятной ошибкой, а не с undefined в середине запроса', () => {
    const { DATABASE_URL: _omitted, ...withoutDb } = minimal
    let error: unknown
    try {
      parseConfig(withoutDb)
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(ConfigError)
    const message = (error as ConfigError).message
    expect(message).toContain('DATABASE_URL')
    expect(message).toContain('.env.example')
  })

  it('перечисляет все проблемы сразу, а не по одной за запуск', () => {
    let error: unknown
    try {
      parseConfig({ APP_NAME: 'x' })
    } catch (caught) {
      error = caught
    }
    const problems = (error as ConfigError).problems
    expect(problems.length).toBeGreaterThanOrEqual(3)
    expect(problems.join('\n')).toContain('SESSION_SECRET')
  })

  it('не принимает короткий секрет сессии', () => {
    expect(() => parseConfig({ ...minimal, SESSION_SECRET: 'коротко' })).toThrow(ConfigError)
  })

  it('не даёт включить SMTP без адреса сервера', () => {
    expect(() => parseConfig({ ...minimal, MAIL_TRANSPORT: 'smtp' })).toThrow(ConfigError)
    expect(() =>
      parseConfig({ ...minimal, MAIL_TRANSPORT: 'smtp', SMTP_HOST: 'smtp.example.ru' }),
    ).not.toThrow()
  })

  it('не принимает долю комиссии, записанную процентом', () => {
    expect(() => parseConfig({ ...minimal, COMMISSION_RATE_SERVICES: '13' })).toThrow(ConfigError)
    expect(parseConfig({ ...minimal, COMMISSION_RATE_SERVICES: '0.13' }).COMMISSION_RATE_SERVICES)
      .toBe(0.13)
  })
})

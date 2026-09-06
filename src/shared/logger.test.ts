import { describe, expect, it } from 'vitest'
import { format } from './logger'

/**
 * За окном запуска на своей машине следит человек. Если вывод перестанет
 * быть читаемым, он не найдёт код подтверждения и не сможет зарегистрироваться —
 * поэтому формат закреплён тестом, а не договорённостью.
 */
describe('человеческий вывод логов', () => {
  it('показывает время, уровень и сообщение', () => {
    const out = format(JSON.stringify({ level: 30, time: 1788600000000, msg: 'воркер запущен' }))
    expect(out).toContain('инфо')
    expect(out).toContain('воркер запущен')
    expect(out).toMatch(/\d{2}:\d{2}:\d{2}/u)
  })

  it('текст письма печатает блоком, а не одной строкой с \\n', () => {
    const out = format(
      JSON.stringify({ level: 30, msg: 'письмо', body: 'Подтвердите почту\n123456\nКод действует' }),
    )
    expect(out).not.toContain('\\n')
    expect(out.split('\n').some((line) => line.trim() === '123456')).toBe(true)
  })

  it('короткие поля остаются в той же строке', () => {
    const out = format(JSON.stringify({ level: 30, msg: 'письмо', to: 'anna@example.ru' }))
    expect(out.split('\n')).toHaveLength(1)
    expect(out).toContain('anna@example.ru')
  })

  it('служебные поля не показывает', () => {
    const out = format(JSON.stringify({ level: 30, msg: 'тест', pid: 4242, hostname: 'сервер-1' }))
    expect(out).not.toContain('pid')
    expect(out).not.toContain('hostname')
    expect(out).not.toContain('сервер-1')
  })

  it('не глотает строки, которые не от нас', () => {
    // Иначе чужой вывод в том же потоке исчезнет, и искать его будет негде
    expect(format('обычная строка, не JSON')).toBe('обычная строка, не JSON')
  })

  it('уровни называет по-русски', () => {
    expect(format(JSON.stringify({ level: 50, msg: 'x' }))).toContain('ошибка')
    expect(format(JSON.stringify({ level: 40, msg: 'x' }))).toContain('внимание')
  })
})

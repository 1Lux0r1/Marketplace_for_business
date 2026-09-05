import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { closeDb, getDb } from '@/shared/db'
import * as notifications from './index'
import { render } from './templates'

/**
 * Письма проверяем на двух вещах: что в журнале не оседают коды и ссылки,
 * и что неудачная отправка не роняет то, ради чего её позвали.
 */

beforeEach(async () => {
  const db = getDb()
  await db.execute(sql`truncate notifications.messages`)
})

afterAll(async () => {
  await closeDb()
})

describe('письма', () => {
  it('в журнале нет ни кода, ни ссылки', async () => {
    await notifications.sendEmail({
      to: 'anna@example.ru',
      template: 'verify_email',
      fullName: 'Анна Ковалёва',
      code: '123456',
    })
    await notifications.sendEmail({
      to: 'anna@example.ru',
      template: 'login_link',
      url: 'https://example.ru/login/secret-token',
    })

    const rows = await notifications.historyFor('anna@example.ru')
    expect(rows).toHaveLength(2)

    // Иначе журнал доставки годится для входа не хуже самого письма
    const dump = JSON.stringify(rows)
    expect(dump).not.toContain('123456')
    expect(dump).not.toContain('secret-token')
  })

  it('записывает, что отправили и когда', async () => {
    const { sent } = await notifications.sendEmail({
      to: 'boris@example.ru',
      template: 'set_password',
      url: 'https://example.ru/password/x',
    })
    expect(sent).toBe(true)

    const [row] = await notifications.historyFor('boris@example.ru')
    expect(row?.status).toBe('sent')
    expect(row?.template).toBe('set_password')
    expect(row?.sentAt).toBeInstanceOf(Date)
  })
})

describe('тексты писем', () => {
  it('код виден и в разметке, и в текстовой версии', () => {
    const letter = render('verify_email', { appName: 'Площадка', code: '482913' })
    // Но не в теме: тема оседает в журнале и в логах почтового сервера
    expect(letter.subject).not.toContain('482913')
    expect(letter.html).toContain('482913')
    // Часть почтовых программ показывает только текстовую версию
    expect(letter.text).toContain('482913')
  })

  it('ссылка есть отдельной строкой — на случай, если кнопка не нажимается', () => {
    const url = 'https://example.ru/login/abc'
    const letter = render('login_link', { appName: 'Площадка', url })
    // Кнопка, адрес запасной ссылки и её видимый текст
    expect(letter.html.match(new RegExp(url, 'g'))).toHaveLength(3)
    expect(letter.text).toContain(url)
  })

  it('имя человека не ломает разметку письма', () => {
    const letter = render('verify_email', {
      appName: 'Площадка',
      fullName: 'Анна <script>alert(1)</script>',
      code: '000000',
    })
    expect(letter.html).not.toContain('<script>')
    expect(letter.html).toContain('&lt;script&gt;')
  })

  it('обращается к человеку, а не к системе', () => {
    const letter = render('set_password', { appName: 'Площадка', fullName: 'Анна Ковалёва' })
    expect(letter.text).toContain('Анна Ковалёва, здравствуйте.')
    // §7: пишем, что сделаем мы, а не что «сформировано системой»
    expect(letter.text.toLowerCase()).not.toContain('сформирован')
    expect(letter.text.toLowerCase()).not.toContain('уведомление')
  })
})

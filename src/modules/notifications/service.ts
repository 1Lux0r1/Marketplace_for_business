import { eq } from 'drizzle-orm'
import { getDb } from '@/shared/db'
import { uuidv7 } from '@/shared/id'
import { config } from '@/shared/config'
import { logger } from '@/shared/logger'
import { messages } from './schema'
import { render, type TemplateName } from './templates'
import { deliver } from './transport'

export type SendInput = {
  to: string
  template: TemplateName
  fullName?: string | undefined
  code?: string | undefined
  url?: string | undefined
  minutes?: number | undefined
  contextId?: string | undefined
}

/**
 * Отправить письмо и записать это в журнал.
 *
 * Отправка не роняет то, ради чего её позвали: если письмо не ушло,
 * человек уже зарегистрирован, а в журнале видно, что доставки не было.
 * Так «письмо не пришло» разбирается по журналу, а не по памяти.
 */
export async function sendEmail(input: SendInput): Promise<{ id: string; sent: boolean }> {
  const cfg = config()
  const letter = render(input.template, {
    appName: cfg.APP_NAME,
    fullName: input.fullName,
    code: input.code,
    url: input.url,
    minutes: input.minutes,
  })

  const db = getDb()
  const id = uuidv7()
  await db.insert(messages).values({
    id,
    channel: 'email',
    address: input.to,
    template: input.template,
    subject: letter.subject,
    contextId: input.contextId ?? null,
    // Ни кода, ни ссылки в журнале: там они лежали бы открытым текстом
    // и годились бы для входа не хуже письма
  })

  const result = await deliver(input.to, letter)

  if (result.ok) {
    await db
      .update(messages)
      .set({ status: 'sent', attempts: 1, sentAt: new Date() })
      .where(eq(messages.id, id))
    return { id, sent: true }
  }

  await db
    .update(messages)
    .set({ status: 'failed', attempts: 1, lastError: result.error })
    .where(eq(messages.id, id))
  logger().error({ messageId: id, template: input.template, err: result.error }, 'письмо не ушло')
  return { id, sent: false }
}

/** История по адресу — для поддержки: «а письмо-то уходило?» */
export async function historyFor(address: string, limit = 20) {
  const db = getDb()
  return db
    .select()
    .from(messages)
    .where(eq(messages.address, address))
    .orderBy(messages.createdAt)
    .limit(limit)
}

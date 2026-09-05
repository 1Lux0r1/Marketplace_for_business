import { createTransport, type Transporter } from 'nodemailer'
import { config } from '@/shared/config'
import { logger } from '@/shared/logger'
import type { Letter } from './templates'

/**
 * Доставка писем. Два режима, переключаются в `.env`:
 *
 * - `log` — письмо не уходит, а пишется в журнал. Разработка и демо: почтовый
 *   сервер не нужен, а код подтверждения виден в логе.
 * - `smtp` — настоящая отправка.
 *
 * Почтовый шлюз должен стоять в РФ (§8): персональные данные россиян
 * не покидают страну, а адрес и имя в письме — это они и есть.
 */

export type Delivery = { ok: true } | { ok: false; error: string }

let transporter: Transporter | undefined

export async function deliver(to: string, letter: Letter): Promise<Delivery> {
  const cfg = config()

  if (cfg.MAIL_TRANSPORT === 'log') {
    logger().info(
      { to, subject: letter.subject, body: letter.text },
      'письмо не отправлено: MAIL_TRANSPORT=log',
    )
    return { ok: true }
  }

  try {
    const mailer = (transporter ??= createTransport({
      host: cfg.SMTP_HOST,
      port: cfg.SMTP_PORT ?? 587,
      // 465 — шифрование с первого байта, остальные порты поднимают его через STARTTLS
      secure: (cfg.SMTP_PORT ?? 587) === 465,
      auth: cfg.SMTP_USER ? { user: cfg.SMTP_USER, pass: cfg.SMTP_PASSWORD } : undefined,
    }))

    await mailer.sendMail({
      from: cfg.SMTP_FROM ?? cfg.SMTP_USER,
      to,
      subject: letter.subject,
      text: letter.text,
      html: letter.html,
    })
    return { ok: true }
  } catch (error: unknown) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** Сбросить соединение — для тестов и для смены настроек без перезапуска. */
export function resetTransport(): void {
  transporter?.close()
  transporter = undefined
}

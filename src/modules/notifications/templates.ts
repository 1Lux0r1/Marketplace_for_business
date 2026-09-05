/**
 * Тексты писем.
 *
 * Пишем от себя и человеку: «мы выпустим договор», а не «документ сформирован
 * системой» (§7). Без извинений и без слова «уведомление».
 *
 * Каждое письмо — с текстовой версией: часть почтовых программ показывает
 * только её, и в них письмо не должно превращаться в пустой лист.
 */

export type TemplateName = 'verify_email' | 'set_password' | 'login_link'

export type Letter = { subject: string; html: string; text: string }

type Vars = {
  appName: string
  fullName?: string | undefined
  code?: string | undefined
  url?: string | undefined
  minutes?: number | undefined
}

export function render(template: TemplateName, vars: Vars): Letter {
  switch (template) {
    case 'verify_email':
      return verifyEmail(vars)
    case 'set_password':
      return setPassword(vars)
    case 'login_link':
      return loginLink(vars)
  }
}

function verifyEmail(v: Vars): Letter {
  const code = v.code ?? ''
  const minutes = v.minutes ?? 15
  return letter({
    // Кода в теме нет намеренно: тема попадает в журнал доставки, в логи
    // почтового сервера и на экран блокировки телефона. Код — это вход
    subject: 'Код подтверждения',
    heading: 'Подтвердите почту',
    greeting: v.fullName,
    body: [
      'Вы завели учётную запись. Чтобы её включить, введите код на странице регистрации:',
    ],
    code,
    footer: [
      `Код действует ${minutes} мин. Если он не подошёл, запросите новый — это займёт минуту.`,
      'Если учётную запись заводили не вы, просто не вводите код: без него она не включится.',
    ],
    appName: v.appName,
  })
}

function setPassword(v: Vars): Letter {
  const minutes = v.minutes ?? 15
  return letter({
    subject: 'Придумайте пароль для входа',
    heading: 'Осталось придумать пароль',
    greeting: v.fullName,
    body: ['Вас добавили в компанию. Чтобы войти, придумайте пароль:'],
    action: { label: 'Придумать пароль', url: v.url ?? '' },
    footer: [
      `Ссылка действует ${minutes} мин и срабатывает один раз.`,
      'Если вы никого не просили вас добавлять — напишите нам, мы разберёмся.',
    ],
    appName: v.appName,
  })
}

function loginLink(v: Vars): Letter {
  const minutes = v.minutes ?? 15
  return letter({
    subject: 'Ссылка для входа',
    heading: 'Вход без пароля',
    greeting: v.fullName,
    body: ['Нажмите кнопку — и вы внутри. Пароль вводить не нужно:'],
    action: { label: 'Войти', url: v.url ?? '' },
    footer: [
      `Ссылка действует ${minutes} мин и срабатывает один раз.`,
      'Если вход запрашивали не вы — ничего делать не нужно, ссылка сама перестанет работать.',
    ],
    appName: v.appName,
  })
}

// ─── Оформление ─────────────────────────────────────────────────────────

type Parts = {
  subject: string
  heading: string
  greeting?: string | undefined
  body: string[]
  code?: string | undefined
  action?: { label: string; url: string } | undefined
  footer: string[]
  appName: string
}

/**
 * Разметка нарочно простая и с цветами прямо в атрибутах: почтовые программы
 * вырезают внешние стили и половину CSS, поэтому правило §7.2 про токены
 * здесь не работает — за пределами приложения токенов не существует.
 */
const GRAPHITE = '#333b45'
const TEAL_TEXT = '#007d74'
const NEUTRAL = '#e5e7eb'

function letter(p: Parts): Letter {
  const hello = p.greeting ? `<p style="margin:0 0 16px">${esc(p.greeting)}, здравствуйте.</p>` : ''
  const paragraphs = p.body.map((t) => `<p style="margin:0 0 16px">${esc(t)}</p>`).join('')

  const code = p.code
    ? `<p style="margin:0 0 24px;font-size:32px;letter-spacing:6px;font-weight:700;` +
      `color:${GRAPHITE}">${esc(p.code)}</p>`
    : ''

  // Кнопка ссылкой, а не <button>: в письме работает только ссылка
  const action = p.action
    ? `<p style="margin:0 0 24px"><a href="${esc(p.action.url)}" ` +
      `style="display:inline-block;padding:12px 24px;background:#00a699;color:${GRAPHITE};` +
      `text-decoration:none;border-radius:8px;font-weight:600">${esc(p.action.label)}</a></p>` +
      `<p style="margin:0 0 24px;font-size:13px;color:${GRAPHITE}">Если кнопка не нажимается, ` +
      `скопируйте адрес: <a href="${esc(p.action.url)}" style="color:${TEAL_TEXT}">` +
      `${esc(p.action.url)}</a></p>`
    : ''

  const footer = p.footer
    .map((t) => `<p style="margin:0 0 8px;font-size:13px;color:${GRAPHITE}">${esc(t)}</p>`)
    .join('')

  const html =
    `<div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:` +
    `-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;` +
    `line-height:1.5;color:${GRAPHITE}">` +
    `<h1 style="margin:0 0 24px;font-size:22px;font-weight:700">${esc(p.heading)}</h1>` +
    hello +
    paragraphs +
    code +
    action +
    `<hr style="border:none;border-top:1px solid ${NEUTRAL};margin:24px 0">` +
    footer +
    `<p style="margin:16px 0 0;font-size:13px;color:${GRAPHITE}">${esc(p.appName)}</p>` +
    `</div>`

  const text = [
    p.heading,
    '',
    p.greeting ? `${p.greeting}, здравствуйте.` : '',
    ...p.body,
    p.code ?? '',
    p.action ? `${p.action.label}: ${p.action.url}` : '',
    '',
    ...p.footer,
    '',
    p.appName,
  ]
    .filter((line) => line !== '')
    .join('\n')

  return { subject: p.subject, html, text }
}

/** Экранирование: имя человека и адрес попадают в разметку письма. */
function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

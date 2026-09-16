import { config } from '@/shared/config'
import { formatKopecks } from '@/shared/money'
import { errors } from './errors'
import type { DocumentKind, Party } from './types'

/**
 * Шаблоны документов: данные → готовый вид.
 *
 * Здесь HTML, а не PDF, и это ПОКА. Библиотеки для PDF в проекте нет,
 * а добавлять зависимость молча нельзя (§3): её сопровождать семь месяцев.
 * Вопрос вынесен разработчику (Q23), а до ответа документ можно смотреть,
 * печатать и сохранять в PDF из браузера — это работает уже сейчас.
 *
 * Когда библиотека появится, меняется одна функция `toPdf` и ничего больше:
 * данные документа и его вид уже разделены.
 */

export type LineItem = {
  title: string
  qty: string
  unit: string
  priceKopecks: bigint
  totalKopecks: bigint
}

export type DocumentData = {
  number: string
  kind: DocumentKind
  issuedAt: Date
  dealNumber: number
  platform: Party & { bank: BankDetails }
  client: Party
  contractorName: string | null
  items: LineItem[]
  totalKopecks: bigint
  /** Как будет подписан: от этого зависит текст про порядок подписания. */
  signingPath: 'electronic' | 'paper'
}

export type BankDetails = {
  name: string
  bic: string
  account: string
  corrAccount: string
}

/**
 * Реквизиты площадки из настроек.
 *
 * Если их нет — документ не выпускается. Подставить «ООО Ромашка»
 * было бы хуже пустоты: такой счёт человек отнесёт в бухгалтерию.
 */
export function platformParty(): Party & { bank: BankDetails } {
  const cfg = config()
  const missing = [
    cfg.PLATFORM_LEGAL_NAME,
    cfg.PLATFORM_INN,
    cfg.PLATFORM_ADDRESS,
    cfg.PLATFORM_BANK_NAME,
    cfg.PLATFORM_BANK_BIC,
    cfg.PLATFORM_BANK_ACCOUNT,
    cfg.PLATFORM_BANK_CORR_ACCOUNT,
  ].some((value) => !value || value.trim() === '')

  if (missing) throw errors.noPlatformDetails()

  return {
    name: cfg.PLATFORM_LEGAL_NAME as string,
    inn: cfg.PLATFORM_INN as string,
    kpp: cfg.PLATFORM_KPP ?? null,
    address: cfg.PLATFORM_ADDRESS as string,
    bank: {
      name: cfg.PLATFORM_BANK_NAME as string,
      bic: cfg.PLATFORM_BANK_BIC as string,
      account: cfg.PLATFORM_BANK_ACCOUNT as string,
      corrAccount: cfg.PLATFORM_BANK_CORR_ACCOUNT as string,
    },
  }
}

const TITLES: Record<DocumentKind, string> = {
  contract: 'Договор',
  invoice: 'Счёт на оплату',
  act: 'Акт о выполненных работах',
}

export function render(data: DocumentData): string {
  const body =
    data.kind === 'invoice' ? invoice(data) : data.kind === 'act' ? act(data) : contract(data)

  return page(`${TITLES[data.kind]} № ${data.number}`, body)
}

// ─── Виды документов ────────────────────────────────────────────────────

function invoice(d: DocumentData): string {
  return `
${header(d)}
${parties(d)}
<h2>За что</h2>
${items(d)}
<h2>Куда платить</h2>
<table class="req">
  <tr><th>Банк</th><td>${esc(d.platform.bank.name)}</td></tr>
  <tr><th>БИК</th><td class="num">${esc(d.platform.bank.bic)}</td></tr>
  <tr><th>Счёт</th><td class="num">${esc(d.platform.bank.account)}</td></tr>
  <tr><th>Корр. счёт</th><td class="num">${esc(d.platform.bank.corrAccount)}</td></tr>
  <tr><th>Назначение</th><td>Оплата по счёту № ${esc(d.number)}</td></tr>
</table>
<p class="note">
  Деньги по этому счёту поступают площадке и удерживаются до тех пор, пока
  вы не примете работу. Подрядчику они уходят после подписания акта.
</p>`
}

function act(d: DocumentData): string {
  return `
${header(d)}
${parties(d)}
<h2>Что сделано</h2>
${items(d)}
<p>
  Работы выполнены полностью и в срок. Заказчик претензий по объёму, качеству
  и срокам не имеет.
</p>
${signatures(d)}`
}

function contract(d: DocumentData): string {
  return `
${header(d)}
${parties(d)}
<h2>О чём договорились</h2>
<ol>
  <li>Площадка организует выполнение работ по заказу № ${d.dealNumber} и отвечает
      перед заказчиком за результат.</li>
  <li>Оплата вносится площадке и удерживается ею до подписания акта
      о выполненных работах.</li>
  <li>После подписания акта площадка перечисляет исполнителю вознаграждение
      за вычетом своей комиссии.</li>
  <li>При несогласии заказчика с результатом деньги не перечисляются исполнителю
      до окончания разбирательства.</li>
</ol>
<p class="note">
  Это рамочные условия заказа. Полный текст договора приложен отдельно.
</p>
${signatures(d)}`
}

// ─── Куски ──────────────────────────────────────────────────────────────

function header(d: DocumentData): string {
  return `
<header>
  <h1>${esc(TITLES[d.kind])} № ${esc(d.number)}</h1>
  <p class="meta">от ${moscowDate(d.issuedAt)} · по заказу № ${d.dealNumber}</p>
</header>`
}

function parties(d: DocumentData): string {
  return `
<h2>Стороны</h2>
<table class="req">
  <tr><th>Исполнитель</th><td>${party(d.platform)}</td></tr>
  <tr><th>Заказчик</th><td>${party(d.client)}</td></tr>
  ${
    d.contractorName
      ? `<tr><th>Работы выполняет</th><td>${esc(d.contractorName)}</td></tr>`
      : ''
  }
</table>`
}

function party(p: Party): string {
  const lines = [
    esc(p.name),
    p.inn ? `ИНН ${esc(p.inn)}` : null,
    p.kpp ? `КПП ${esc(p.kpp)}` : null,
    p.address ? esc(p.address) : null,
  ].filter(Boolean)
  return lines.join('<br>')
}

function items(d: DocumentData): string {
  const rows = d.items
    .map(
      (item) => `
    <tr>
      <td>${esc(item.title)}</td>
      <td class="num">${esc(qty(item.qty))} ${esc(item.unit)}</td>
      <td class="num">${formatKopecks(item.priceKopecks)}</td>
      <td class="num">${formatKopecks(item.totalKopecks)}</td>
    </tr>`,
    )
    .join('')

  return `
<table class="items">
  <thead>
    <tr><th>Наименование</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr>
  </thead>
  <tbody>${rows}</tbody>
  <tfoot>
    <tr><th colspan="3">Итого</th><td class="num total">${formatKopecks(d.totalKopecks)}</td></tr>
  </tfoot>
</table>`
}

/**
 * Место для подписи — разное на двух путях (`docs/11-electronic-signature.md`).
 * На бумажном пути его печатают и подписывают руками, на электронном
 * подпись ставится в системе, и линейка для ручки была бы враньём.
 */
function signatures(d: DocumentData): string {
  if (d.signingPath === 'electronic') {
    // Пока нет оператора ЭДО, подпись в системе простая, а не усиленная
    // квалифицированная (Q24, Q25). Написать в документе «УКЭП» значило бы
    // соврать в том самом месте, которое читают при споре
    return `
<p class="note">
  Документ подписывается электронной подписью в системе: сторона входит
  под своей учётной записью и подтверждает подписание. Стороны признают
  такое подписание равным собственноручному.
</p>`
  }

  return `
<table class="sign">
  <tr>
    <td><span>Исполнитель</span><i></i><small>${esc(d.platform.name)}</small></td>
    <td><span>Заказчик</span><i></i><small>${esc(d.client.name)}</small></td>
  </tr>
</table>
<p class="note">
  Распечатайте, подпишите и загрузите скан в систему. Наш сотрудник сверит
  его и отметит документ подписанным.
</p>`
}

// ─── Обёртка ────────────────────────────────────────────────────────────

/**
 * Документ — самостоятельный файл: его сохраняют, пересылают и печатают
 * отдельно от системы. Поэтому стили внутри, а не из приложения.
 */
function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  body { font: 14px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
         color: #333b45; max-width: 800px; margin: 0 auto; padding: 32px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 28px 0 8px; text-transform: uppercase;
       letter-spacing: .04em; color: #6b7280; }
  .meta { color: #6b7280; margin: 0; }
  table { width: 100%; border-collapse: collapse; }
  .req th { text-align: left; width: 180px; vertical-align: top; padding: 6px 12px 6px 0;
            font-weight: 600; color: #6b7280; }
  .req td { padding: 6px 0; vertical-align: top; }
  .items th, .items td { border-bottom: 1px solid #e5e7eb; padding: 8px 6px; text-align: left; }
  .items thead th { color: #6b7280; font-size: 12px; text-transform: uppercase; }
  .num { font-variant-numeric: tabular-nums; text-align: right; }
  .total { font-size: 17px; font-weight: 700; }
  .note { background: #f6f7f8; border-radius: 8px; padding: 12px 14px; color: #4b5563; }
  .sign td { width: 50%; padding: 32px 12px 0 0; vertical-align: bottom; }
  .sign span { display: block; font-size: 12px; color: #6b7280; }
  .sign i { display: block; border-bottom: 1px solid #333b45; height: 28px; }
  .sign small { color: #6b7280; }
  ol { padding-left: 20px; }
  li { margin-bottom: 6px; }
  @media print { body { padding: 0; } .note { background: none; border: 1px solid #e5e7eb; } }
</style>
</head><body>${body}</body></html>`
}

/**
 * Экранирование. Обязательно: в документ попадают названия компаний
 * и описания услуг, которые писали люди, а не мы.
 */
function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * Количество человеческим видом. База отдаёт `numeric` как «1.000»,
 * а в документе пишут «1»: лишние нули читаются как точность,
 * которой в заказе не было.
 */
function qty(value: string): string {
  if (!/^\d+\.\d+$/u.test(value)) return value
  const trimmed = value.replace(/0+$/u, '').replace(/\.$/u, '')
  return trimmed === '' ? '0' : trimmed
}

function moscowDate(when: Date): string {
  return when.toLocaleDateString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { closeDb, getDb } from '@/shared/db'
import * as platform from '@/modules/platform'
import * as documents from './index'
import { DocumentError } from './errors'
import { nextNumber } from './numbering'
import { resetConfigCache } from '@/shared/config'
import { platformParty } from './templates'

/**
 * Реквизиты площадки — выдуманные и только для теста. В настоящей установке
 * они приходят из настроек, и без них документы не выпускаются (см. ниже).
 */
const TEST_DETAILS = {
  PLATFORM_LEGAL_NAME: 'ООО «Тестовая площадка»',
  PLATFORM_INN: '7700000000',
  PLATFORM_KPP: '770001001',
  PLATFORM_ADDRESS: 'Москва, Тестовая 1',
  PLATFORM_BANK_NAME: 'Тестовый банк',
  PLATFORM_BANK_BIC: '044525000',
  PLATFORM_BANK_ACCOUNT: '40702810000000000001',
  PLATFORM_BANK_CORR_ACCOUNT: '30101810000000000000',
}

/**
 * Документы. §8 требует «нумерацию счетов и актов без пропусков и дублей»
 * и запрещает выплату без подписанного акта — и то и другое проверяется здесь.
 */

async function rejection(promise: Promise<unknown>): Promise<DocumentError> {
  try {
    await promise
  } catch (error: unknown) {
    if (error instanceof DocumentError) return error
    throw error
  }
  throw new Error('Ожидался отказ, но вызов прошёл успешно')
}

beforeEach(async () => {
  Object.assign(process.env, TEST_DETAILS)
  resetConfigCache()

  const db = getDb()
  await db.execute(sql`truncate documents.documents, documents.counters`)
  await db.execute(sql`truncate platform.orgs cascade`)
  await db.execute(
    sql`truncate platform.login_attempts, platform.login_tokens restart identity cascade`,
  )
})

afterAll(async () => {
  await closeDb()
})

async function makeClient() {
  const { orgId, emailCode } = await platform.register({
    legalForm: 'company',
    companyName: 'Кофейня «Пример»',
    inn: '7701234560',
    fullName: 'Анна Ковалёва',
    email: 'anna@example.ru',
    phone: '+7 916 123-45-67',
    password: 'корова лошадь батарейка',
  })
  await platform.verifyEmail({ email: 'anna@example.ru', code: emailCode })
  return orgId
}

const item = {
  title: 'Санобработка кухни',
  qty: '1',
  unit: 'объект',
  priceKopecks: 500_000n,
  totalKopecks: 500_000n,
}

async function issueInvoice(clientOrgId: string, over: Record<string, unknown> = {}) {
  return documents.issue({
    kind: 'invoice',
    dealId: '01a00000-0000-7000-8000-00000000d001',
    dealNumber: 1240,
    clientOrgId,
    signingPath: 'electronic',
    items: [item],
    ...over,
  })
}

describe('нумерация без пропусков и дублей (§8)', () => {
  /**
   * ГЛАВНЫЙ ТЕСТ ЭТОГО МОДУЛЯ, и он же — причина, по которой номер берётся
   * из строки под блокировкой, а не из последовательности базы.
   *
   * Последовательность этот тест не проходит: откат номер не возвращает,
   * и в нумерации счетов появляется дырка, которую придётся объяснять
   * бухгалтеру.
   */
  it('откат выпуска не съедает номер', async () => {
    const orgId = await makeClient()
    const db = getDb()

    const first = await issueInvoice(orgId)
    expect(first.number).toMatch(/^СЧ-\d{4}-000001$/u)

    // Выпуск, который не состоялся
    await expect(
      db.transaction(async (tx) => {
        await nextNumber(tx, 'invoice')
        throw new Error('что-то пошло не так уже после взятия номера')
      }),
    ).rejects.toThrow()

    const second = await issueInvoice(orgId)
    expect(second.number, 'номер не должен пропасть при откате').toMatch(/^СЧ-\d{4}-000002$/u)
  })

  it('номера идут подряд', async () => {
    const orgId = await makeClient()
    const numbers: string[] = []
    for (let i = 0; i < 5; i += 1) numbers.push((await issueInvoice(orgId)).number)

    expect(numbers.map((n) => n.slice(-6))).toEqual([
      '000001',
      '000002',
      '000003',
      '000004',
      '000005',
    ])
  })

  /** Два счёта с одним номером — это уже не бухгалтерия, а подлог. */
  it('одновременный выпуск не даёт двух одинаковых номеров', async () => {
    const orgId = await makeClient()
    const made = await Promise.all([
      issueInvoice(orgId),
      issueInvoice(orgId),
      issueInvoice(orgId),
      issueInvoice(orgId),
    ])

    const numbers = made.map((d) => d.number)
    expect(new Set(numbers).size, `дубль в номерах: ${numbers.join(', ')}`).toBe(4)
  })

  it('у каждого вида документа своя нумерация', async () => {
    const orgId = await makeClient()
    const invoice = await issueInvoice(orgId)
    const act = await issueInvoice(orgId, { kind: 'act' })

    expect(invoice.number).toContain('СЧ-')
    expect(act.number).toContain('АКТ-')
    expect(invoice.number.slice(-6)).toBe('000001')
    expect(act.number.slice(-6)).toBe('000001')
  })

  /**
   * Год берётся по Москве, а не по UTC: 1 января в 02:00 по Москве — это ещё
   * 31 декабря по UTC, и счёт ушёл бы в нумерацию прошлого года.
   */
  it('год в номере считает по Москве', async () => {
    const db = getDb()
    const newYearNight = new Date('2027-01-01T02:00:00+03:00')
    const number = await db.transaction((tx) => nextNumber(tx, 'invoice', newYearNight))
    expect(number).toContain('-2027-')
  })
})

describe('выпуск документа', () => {
  it('считает итог и хранит сумму в копейках (§6)', async () => {
    const orgId = await makeClient()
    const doc = await issueInvoice(orgId, {
      items: [
        { ...item, qty: '2', totalKopecks: 1_000_000n },
        { ...item, title: 'Выезд', totalKopecks: 150_000n },
      ],
    })

    expect(doc.amountKopecks).toBe(1_150_000n)
    expect(typeof doc.amountKopecks).toBe('bigint')
  })

  /**
   * Компанию переименуют, а выданный счёт обязан остаться тем, что подписали
   * и отнесли в бухгалтерию.
   */
  it('реквизиты сторон хранит снимком', async () => {
    const orgId = await makeClient()
    const doc = await issueInvoice(orgId)
    expect(doc.html).toContain('Кофейня «Пример»')

    await getDb().execute(sql`update platform.orgs set name = 'Совсем другое' where id = ${orgId}`)

    const again = await documents.getDocument(doc.id)
    expect(again.html).toContain('Кофейня «Пример»')
  })

  it('в договоре суммы нет, в счёте и акте есть', async () => {
    const orgId = await makeClient()
    expect((await issueInvoice(orgId, { kind: 'contract' })).amountKopecks).toBeNull()
    expect((await issueInvoice(orgId, { kind: 'act' })).amountKopecks).toBe(500_000n)
  })

  /** В документ попадают названия, которые писали люди, а не мы. */
  it('экранирует то, что написали люди', async () => {
    const orgId = await makeClient()
    const doc = await issueInvoice(orgId, {
      items: [{ ...item, title: '<script>alert(1)</script>' }],
    })

    expect(doc.html).not.toContain('<script>alert(1)</script>')
    expect(doc.html).toContain('&lt;script&gt;')
  })

  it('не выпускает документ без позиций', async () => {
    const orgId = await makeClient()
    expect((await rejection(issueInvoice(orgId, { items: [] }))).code).toBe('bad_document')
  })

  /** База отдаёт «1.000», а в документе пишут «1»: нули читаются как точность. */
  it('количество пишет человеческим видом, без лишних нулей', async () => {
    const orgId = await makeClient()
    const doc = await issueInvoice(orgId, {
      items: [
        { ...item, qty: '1.000' },
        { ...item, title: 'Второе', qty: '2.500' },
        { ...item, title: 'Третье', qty: '3' },
      ],
    })

    expect(doc.html).toContain('>1 объект<')
    expect(doc.html).toContain('>2.5 объект<')
    expect(doc.html).toContain('>3 объект<')
    expect(doc.html).not.toContain('1.000')
  })

  it('обещание площадки написано прямо в счёте', async () => {
    const orgId = await makeClient()
    const doc = await issueInvoice(orgId)
    expect(doc.html).toContain('удерживаются до тех пор, пока')
  })
})

describe('подписание', () => {
  /**
   * На бумажном пути отметку ставит оператор, сверив скан
   * (`docs/11-electronic-signature.md`). Иначе любая сторона отметила бы
   * подписание сама — и обошла бы гарант.
   */
  it('бумажный документ отмечает подписанным только оператор', async () => {
    const orgId = await makeClient()
    const act = await issueInvoice(orgId, { kind: 'act', signingPath: 'paper' })

    const error = await rejection(
      documents.markSigned({
        documentId: act.id,
        byOperator: false,
        signedBy: '01a00000-0000-7000-8000-0000000000aa',
        signature: { scan: 'загружен' },
      }),
    )
    expect(error.code).toBe('needs_operator')

    const signed = await documents.markSigned({
      documentId: act.id,
      byOperator: true,
      signedBy: '01a00000-0000-7000-8000-0000000000bb',
      signature: { scan: 'загружен', checkedBy: 'оператор' },
    })
    expect(signed.status).toBe('signed')
  })

  it('подписанный документ не подписывают дважды', async () => {
    const orgId = await makeClient()
    const act = await issueInvoice(orgId, { kind: 'act' })
    const sign = {
      documentId: act.id,
      byOperator: false,
      signedBy: '01a00000-0000-7000-8000-0000000000aa',
      signature: { kind: 'укэп' },
    }

    await documents.markSigned(sign)
    expect((await rejection(documents.markSigned(sign))).code).toBe('already_signed')
  })

  it('хранит, на основании чего документ считается подписанным', async () => {
    const orgId = await makeClient()
    const act = await issueInvoice(orgId, { kind: 'act' })
    const signed = await documents.markSigned({
      documentId: act.id,
      byOperator: false,
      signedBy: '01a00000-0000-7000-8000-0000000000aa',
      signature: { kind: 'укэп', serial: 'AB12', checkedAt: '2026-09-16T10:00:00Z' },
    })

    expect(signed.signature).toMatchObject({ kind: 'укэп', serial: 'AB12' })
    expect(signed.signedAt).toBeInstanceOf(Date)
  })
})

describe('подписанный акт — условие выплаты (§8)', () => {
  const dealId = '01a00000-0000-7000-8000-00000000d001'

  it('без акта выплата не разрешена', async () => {
    const orgId = await makeClient()
    await issueInvoice(orgId)
    expect(await documents.hasSignedAct(dealId)).toBe(false)
  })

  /** Выставленный, но не подписанный акт — это ещё не приёмка. */
  it('выставленного акта мало, нужен подписанный', async () => {
    const orgId = await makeClient()
    const act = await issueInvoice(orgId, { kind: 'act' })
    expect(await documents.hasSignedAct(dealId)).toBe(false)

    await documents.markSigned({
      documentId: act.id,
      byOperator: false,
      signedBy: '01a00000-0000-7000-8000-0000000000aa',
      signature: { kind: 'укэп' },
    })
    expect(await documents.hasSignedAct(dealId)).toBe(true)
  })

  it('аннулированный акт приёмкой не считается', async () => {
    const orgId = await makeClient()
    const act = await issueInvoice(orgId, { kind: 'act' })
    await documents.voidDocument({ documentId: act.id, reason: 'Ошиблись в объёме' })
    expect(await documents.hasSignedAct(dealId)).toBe(false)
  })
})

describe('выданный документ не меняется', () => {
  it('команды правки в модуле нет', () => {
    const surface = Object.keys(documents)
    expect(surface.filter((name) => /^(update|edit|change|fix)/iu.test(name))).toEqual([])
  })

  it('подписанный документ нельзя аннулировать', async () => {
    const orgId = await makeClient()
    const act = await issueInvoice(orgId, { kind: 'act' })
    await documents.markSigned({
      documentId: act.id,
      byOperator: false,
      signedBy: '01a00000-0000-7000-8000-0000000000aa',
      signature: { kind: 'укэп' },
    })

    const error = await rejection(
      documents.voidDocument({ documentId: act.id, reason: 'Передумали' }),
    )
    expect(error.code).toBe('already_signed')
  })

  it('аннулирование требует причины', async () => {
    const orgId = await makeClient()
    const doc = await issueInvoice(orgId)
    expect((await rejection(documents.voidDocument({ documentId: doc.id, reason: '  ' }))).code).toBe(
      'bad_document',
    )
  })
})

describe('без реквизитов площадки документы не выпускаются (§9.7)', () => {
  /**
   * Счёт с выдуманным ИНН хуже, чем отсутствие счёта: его отнесут
   * в бухгалтерию и попробуют по нему заплатить. Поэтому значений
   * по умолчанию у реквизитов нет, и модуль отказывается их придумывать.
   */
  it('говорит, чего не хватает, вместо того чтобы подставить своё', () => {
    for (const key of Object.keys(TEST_DETAILS)) delete process.env[key]
    resetConfigCache()

    try {
      let thrown: DocumentError | null = null
      try {
        platformParty()
      } catch (error: unknown) {
        thrown = error instanceof DocumentError ? error : null
      }

      expect(thrown?.code).toBe('no_platform_details')
      expect(thrown?.message).toContain('реквизиты площадки')
    } finally {
      Object.assign(process.env, TEST_DETAILS)
      resetConfigCache()
    }
  })

  it('КПП не обязателен: у ИП его не бывает', () => {
    Object.assign(process.env, TEST_DETAILS)
    delete process.env.PLATFORM_KPP
    resetConfigCache()

    expect(platformParty().kpp).toBeNull()
  })
})

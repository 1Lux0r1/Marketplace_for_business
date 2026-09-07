import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { closeDb, getDb } from '@/shared/db'
import * as platform from './index'
import { PlatformError } from './errors'
import { credentials, loginTokens, sessions } from './schema'

/**
 * Права доступа — обязательный тест (§8). Плюс всё, где ошибка тихая:
 * утечка состава участников, подбор пароля, чужая сессия.
 */

/** Ждёт отказа и возвращает ошибку площадки: иначе тест падает здесь, а не ниже. */
async function rejection(promise: Promise<unknown>): Promise<PlatformError> {
  try {
    await promise
  } catch (error: unknown) {
    if (error instanceof PlatformError) return error
    throw error
  }
  throw new Error('Ожидался отказ, но вызов прошёл успешно')
}

beforeEach(async () => {
  const db = getDb()
  await db.execute(
    sql`truncate platform.orgs, platform.login_attempts, platform.login_tokens cascade`,
  )
})

afterAll(async () => {
  await closeDb()
})

/** Выдуманные ИНН, у которых сходится контрольная цифра: иначе `register` их не примет. */
const DEMO_INNS = [
  '7701000019', '7701000026', '7701000033', '7701000040',
  '7701000058', '7701000065', '7701000072', '7701000080',
  '7701000097', '7701000107', '7701000114', '7701000121',
] as const

const registration = {
  legalForm: 'company' as const,
  companyName: 'Кофейня «Пример»',
  inn: '7701234560',
  fullName: 'Анна Ковалёва',
  position: 'Директор',
  email: 'anna@example.ru',
  phone: '+7 916 123-45-67',
  password: 'корова лошадь батарейка',
}

async function registerAndConfirm(overrides: Partial<typeof registration> = {}) {
  const input = { ...registration, ...overrides }
  const { userId, orgId, emailCode } = await platform.register(input)
  await platform.verifyEmail({ email: input.email, code: emailCode })
  return { userId, orgId, input }
}

describe('регистрация', () => {
  it('заводит компанию и делает человека её владельцем', async () => {
    const { userId, orgId } = await registerAndConfirm()

    const org = await platform.getOrg(orgId)
    expect(org.name).toBe('Кофейня «Пример»')
    expect(org.isClient).toBe(true)
    // Роль подрядчика включается отдельным действием, а не при регистрации
    expect(org.isContractor).toBe(false)

    const user = await platform.getUser(userId)
    expect(user.role).toBe('owner')
    expect(user.position).toBe('Директор')
    expect(user.phone).toBe('+79161234567')
  })

  it('до подтверждения почты войти нельзя', async () => {
    await platform.register(registration)
    await expect(
      platform.loginWithPassword({
        login: registration.email,
        password: registration.password,
        remember: false,
      }),
    ).rejects.toMatchObject({ code: 'not_verified' })
  })

  it('не даёт зарегистрировать вторую учётную запись на тот же адрес', async () => {
    await platform.register(registration)
    await expect(platform.register(registration)).rejects.toMatchObject({ code: 'email_taken' })
  })

  it('вторая регистрация той же компании отправляет за приглашением', async () => {
    await platform.register(registration)
    // Другой человек, тот же ИНН: вступать в чужую компанию по одному ИНН нельзя
    await expect(
      platform.register({ ...registration, email: 'boris@example.ru', phone: '+79161112233' }),
    ).rejects.toMatchObject({ code: 'inn_taken' })
  })

  it('отклонённая регистрация не оставляет компанию в базе', async () => {
    await platform.register(registration)

    await expect(
      platform.register({ ...registration, companyName: 'Другая', inn: '7702345672' }),
    ).rejects.toMatchObject({ code: 'email_taken' })

    // Ни одной лишней компании: разбирать компании без владельца пришлось бы руками
    const db = getDb()
    const rows = await db.execute(sql`select count(*)::int as n from platform.orgs`)
    expect((rows as unknown as { n: number }[])[0]?.n).toBe(1)
  })

  it('отклоняет слабый пароль и кривой телефон понятным текстом', async () => {
    await expect(platform.register({ ...registration, password: 'коротк' })).rejects.toBeInstanceOf(
      PlatformError,
    )
    await expect(
      platform.register({ ...registration, email: 'b@example.ru', phone: '123' }),
    ).rejects.toMatchObject({ code: 'bad_phone' })
  })

  it('физлицо регистрируется без ИНН, названием становится его имя', async () => {
    // Физлицу поля ИНН и названия на экране не показывают (docs/12-auth-ux.md)
    const { orgId } = await platform.register({
      legalForm: 'individual',
      companyName: 'Анна Ковалёва',
      fullName: 'Анна Ковалёва',
      email: 'anna@example.ru',
      phone: '+79161234567',
      password: 'корова лошадь батарейка',
    })
    const org = await platform.getOrg(orgId)
    expect(org.legalForm).toBe('individual')
    expect(org.name).toBe('Анна Ковалёва')
    expect(org.inn).toBeNull()
  })

  it('не пускает в базу ИНН с опечаткой', async () => {
    // Неверный ИНН всплывает в договоре и счёте, где исправлять его дорого
    for (const inn of ['не-инн-вообще', '12345', '7701234561']) {
      const error = await rejection(platform.register({ ...registration, inn }))
      expect(error.code, inn).toBe('bad_inn')
    }
  })

  it('требует ИНН у юрлица и ИП, но не у физлица', async () => {
    const missing = await rejection(platform.register({ ...registration, inn: undefined }))
    expect(missing.code).toBe('inn_required')

    // У ИП номер из 12 цифр, у юрлица из 10 — перепутанные не принимаем
    const wrongKind = await rejection(
      platform.register({ ...registration, legalForm: 'sole_trader' }),
    )
    expect(wrongKind.code).toBe('bad_inn')
  })

  it('не принимает имя и название любой длины', async () => {
    const error = await rejection(
      platform.register({ ...registration, fullName: 'А'.repeat(5000) }),
    )
    expect(error.code).toBe('too_long')
  })

  it('подтверждение почты сразу впускает, а не отправляет вводить пароль заново', async () => {
    const { emailCode } = await platform.register(registration)
    const result = await platform.verifyEmail({ email: registration.email, code: emailCode })

    const session = await platform.getSession(result.token)
    expect(session?.email).toBe(registration.email)
    expect(session?.emailVerified).toBe(true)
  })

  it('код подтверждения сгорает после пяти неверных попыток', async () => {
    const { emailCode } = await platform.register(registration)
    const wrong = emailCode === '000000' ? '111111' : '000000'

    for (let i = 0; i < 5; i += 1) {
      await expect(
        platform.verifyEmail({ email: registration.email, code: wrong }),
      ).rejects.toBeInstanceOf(PlatformError)
    }
    // Даже верный код теперь не подходит: перебор шести цифр закрыт
    await expect(
      platform.verifyEmail({ email: registration.email, code: emailCode }),
    ).rejects.toMatchObject({ code: 'too_many_attempts' })
  })
})

describe('повторная отправка кода', () => {
  it('вытаскивает из тупика: старый код протух, новый работает', async () => {
    // Без этого регистрация — дорога в один конец: войти нельзя (почта
    // не подтверждена), зарегистрироваться заново нельзя (адрес занят)
    await platform.register(registration)
    const db = getDb()
    await db.execute(sql`update platform.login_tokens set expires_at = now() - interval '1 hour'`)

    const expired = await rejection(
      platform.verifyEmail({ email: registration.email, code: '000000' }),
    )
    expect(expired.code).toBe('token_expired')

    const { code } = await platform.resendEmailCode({ email: registration.email })
    expect(code).toBeTypeOf('string')

    const result = await platform.verifyEmail({ email: registration.email, code: code! })
    expect(result.user.emailVerified).toBe(true)
  })

  it('на незнакомый адрес отвечает так же, как на знакомый', async () => {
    await platform.register(registration)
    // Иначе форма отвечает на вопрос «кто у вас зарегистрирован»
    await expect(platform.resendEmailCode({ email: 'never@example.ru' })).resolves.toEqual({
      code: null,
      fullName: null,
    })
  })

  it('подтверждённой почте нового кода не выдаёт', async () => {
    await registerAndConfirm()
    const { code } = await platform.resendEmailCode({ email: registration.email })
    expect(code).toBeNull()
  })

  it('не даёт слать коды без остановки', async () => {
    await platform.register(registration)
    // Одна регистрация уже потратила письмо, остаётся два
    for (let i = 0; i < 2; i += 1) await platform.resendEmailCode({ email: registration.email })
    await expect(platform.resendEmailCode({ email: registration.email })).rejects.toMatchObject({
      code: 'too_many_attempts',
    })
  })

  it('ограничивает и число регистраций с одного места', async () => {
    // Иначе форма регистрации — бесплатная рассылка писем с нашего домена
    // на любые адреса, а платим за репутацию домена мы
    const ip = '198.51.100.7'
    let created = 0
    let refused: string | null = null

    for (let i = 0; i < 12; i += 1) {
      try {
        await platform.register({
          ...registration,
          email: `person${i}@example.ru`,
          inn: DEMO_INNS[i]!,
          phone: `+7916000${String(i).padStart(4, '0')}`,
          ip,
        })
        created += 1
      } catch (error: unknown) {
        refused = error instanceof PlatformError ? error.code : 'не наша ошибка'
        break
      }
    }

    expect(created).toBeLessThan(12)
    expect(refused).toBe('too_many_attempts')
  })

  it('говорит про код, а не про ссылку', async () => {
    // Человек держит перед глазами шесть цифр, и совет «скопируйте ссылку
    // целиком» ему ничего не объясняет (§7.4)
    await platform.register(registration)

    const wrong = await rejection(
      platform.verifyEmail({ email: registration.email, code: '000001' }),
    )
    expect(wrong.message).toContain('Код')
    expect(wrong.message).not.toContain('сылк')

    const db = getDb()
    await db.execute(sql`update platform.login_tokens set expires_at = now() - interval '1 hour'`)
    const expired = await rejection(
      platform.verifyEmail({ email: registration.email, code: '000001' }),
    )
    expect(expired.message).toContain('код')
    expect(expired.message).not.toContain('сылк')
  })
})

describe('вход по паролю', () => {
  it('пускает с верным паролем и выдаёт сессию', async () => {
    const { userId } = await registerAndConfirm()
    const result = await platform.loginWithPassword({
      login: registration.email,
      password: registration.password,
      remember: false,
    })
    expect(result.user.id).toBe(userId)

    const session = await platform.getSession(result.token)
    expect(session?.id).toBe(userId)
  })

  it('неверный пароль и несуществующий логин отвечают одинаково', async () => {
    await registerAndConfirm()

    const wrongPassword = await rejection(
      platform.loginWithPassword({
        login: registration.email,
        password: 'неверный пароль',
        remember: false,
      }),
    )
    const noSuchUser = await rejection(
      platform.loginWithPassword({
        login: 'never@example.ru',
        password: 'какой угодно',
        remember: false,
      }),
    )

    // Иначе форма входа отвечает на вопрос «кто у вас зарегистрирован»
    expect(wrongPassword.code).toBe('wrong_credentials')
    expect(noSuchUser.code).toBe('wrong_credentials')
    expect(wrongPassword.message).toBe(noSuchUser.message)
  })

  it('после пяти неудач подряд делает паузу', async () => {
    await registerAndConfirm()
    for (let i = 0; i < 5; i += 1) {
      await expect(
        platform.loginWithPassword({
          login: registration.email,
          password: 'мимо',
          remember: false,
        }),
      ).rejects.toMatchObject({ code: 'wrong_credentials' })
    }
    // Шестая попытка отклоняется до проверки пароля — даже с верным
    await expect(
      platform.loginWithPassword({
        login: registration.email,
        password: registration.password,
        remember: false,
      }),
    ).rejects.toMatchObject({ code: 'too_many_attempts' })
  })

  it('«запомнить» продлевает сессию, без него она короткая', async () => {
    await registerAndConfirm()
    const short = await platform.loginWithPassword({
      login: registration.email,
      password: registration.password,
      remember: false,
    })
    const long = await platform.loginWithPassword({
      login: registration.email,
      password: registration.password,
      remember: true,
    })
    expect(long.expiresAt.getTime()).toBeGreaterThan(short.expiresAt.getTime())
  })
})

describe('вход по телефону', () => {
  it('не работает, пока телефон не подтверждён', async () => {
    await registerAndConfirm()
    await expect(
      platform.loginWithPassword({
        login: '+79161234567',
        password: registration.password,
        remember: false,
      }),
    ).rejects.toMatchObject({ code: 'wrong_credentials' })
  })
})

describe('вход по ссылке на почту', () => {
  it('на незнакомый адрес отвечает так же, как на знакомый', async () => {
    await registerAndConfirm()
    await expect(platform.startLogin({ email: 'never@example.ru' })).resolves.toEqual({
      token: null,
    })
    const known = await platform.startLogin({ email: registration.email })
    expect(known.token).toBeTypeOf('string')
  })

  it('ссылка срабатывает один раз', async () => {
    await registerAndConfirm()
    const { token } = await platform.startLogin({ email: registration.email })
    await platform.completeLogin({ token: token!, remember: false })
    await expect(
      platform.completeLogin({ token: token!, remember: false }),
    ).rejects.toMatchObject({ code: 'token_used' })
  })

  it('просроченная ссылка объясняет, что делать', async () => {
    await registerAndConfirm()
    const { token } = await platform.startLogin({ email: registration.email })

    const db = getDb()
    await db.execute(sql`update platform.login_tokens set expires_at = now() - interval '1 hour'`)

    const error = await rejection(platform.completeLogin({ token: token!, remember: false }))
    expect(error.code).toBe('token_expired')
    expect(error.message).toContain('новую')
  })

  it('не даёт слать письма без остановки', async () => {
    await registerAndConfirm()
    for (let i = 0; i < 3; i += 1) await platform.startLogin({ email: registration.email })
    await expect(platform.startLogin({ email: registration.email })).rejects.toMatchObject({
      code: 'too_many_attempts',
    })
  })
})

describe('права', () => {
  it('сотрудник не может делать то, что требует оператора', async () => {
    const staff = { id: 'x', orgId: 'o', role: 'staff' as const }
    expect(() => platform.requireRole(staff, 'operator')).toThrow(PlatformError)
    expect(() => platform.requireRole(staff, 'staff')).not.toThrow()
  })

  it('чужая организация недоступна, даже если знать её номер', async () => {
    const owner = { id: 'x', orgId: 'своя', role: 'owner' as const }
    expect(() => platform.requireSameOrg(owner, 'чужая')).toThrow(PlatformError)
    expect(() => platform.requireSameOrg(owner, 'своя')).not.toThrow()
    // Оператор площадки видит чужие организации по роду работы
    const operator = { id: 'y', orgId: 'площадка', role: 'operator' as const }
    expect(() => platform.requireSameOrg(operator, 'чужая')).not.toThrow()
  })

  it('нельзя пригласить человека с правами выше своих', async () => {
    const { userId, orgId } = await registerAndConfirm()
    const owner = await platform.getUser(userId)

    await expect(
      platform.inviteUser({
        actor: owner,
        orgId,
        email: 'admin@example.ru',
        phone: '+79161112233',
        fullName: 'Кто-то',
        role: 'admin',
      }),
    ).rejects.toMatchObject({ code: 'forbidden' })

    const invited = await platform.inviteUser({
      actor: owner,
      orgId,
      email: 'staff@example.ru',
      phone: '+79161112233',
      fullName: 'Сотрудник',
      role: 'staff',
    })
    expect(invited.setPasswordToken).toBeTypeOf('string')
  })

  it('приглашённый ставит пароль по ссылке и входит', async () => {
    const { userId, orgId } = await registerAndConfirm()
    const owner = await platform.getUser(userId)
    const { setPasswordToken } = await platform.inviteUser({
      actor: owner,
      orgId,
      email: 'staff@example.ru',
      phone: '+79162223344',
      fullName: 'Сотрудник',
      role: 'staff',
    })

    await platform.setPasswordByToken({
      token: setPasswordToken,
      password: 'другой длинный пароль',
    })
    const result = await platform.loginWithPassword({
      login: 'staff@example.ru',
      password: 'другой длинный пароль',
      remember: false,
    })
    expect(result.user.role).toBe('staff')
  })
})

describe('что лежит в базе', () => {
  it('ни одного пароля и ни одной ссылки в открытом виде', async () => {
    const { input } = await registerAndConfirm()
    const { token } = await platform.startLogin({ email: input.email })

    const db = getDb()
    const storedCredentials = await db.select().from(credentials)
    const storedTokens = await db.select().from(loginTokens)
    const storedSessions = await db.select().from(sessions)

    const dump = JSON.stringify([storedCredentials, storedTokens, storedSessions])
    expect(dump).not.toContain(input.password)
    expect(dump).not.toContain(token)
    expect(storedCredentials[0]?.secretHash).toMatch(/^scrypt\$/)
  })

  it('выход удаляет сессию, а не помечает её', async () => {
    await registerAndConfirm()
    const { token } = await platform.loginWithPassword({
      login: registration.email,
      password: registration.password,
      remember: true,
    })

    // Считаем до и после: подтверждение почты тоже впускает человека,
    // поэтому «ноль строк» здесь означало бы не то, что проверяем
    const db = getDb()
    const before = await db.select().from(sessions)
    await platform.logout(token)
    const after = await db.select().from(sessions)

    expect(await platform.getSession(token)).toBeNull()
    // Строка исчезла, а не осталась с пометкой
    expect(after).toHaveLength(before.length - 1)
  })

  it('живая сессия не открывает данные чужой организации', async () => {
    await registerAndConfirm()
    const { orgId: strangerOrgId } = await registerAndConfirm({
      email: 'boris@example.ru',
      phone: '+79161112233',
      companyName: 'Салон «Чужой»',
      inn: '7702345672',
      fullName: 'Борис Петров',
    })

    const { token } = await platform.loginWithPassword({
      login: registration.email,
      password: registration.password,
      remember: false,
    })
    const me = await platform.getSession(token)
    expect(me?.email).toBe(registration.email)

    // Сессия говорит, кто пришёл, а не что ему можно: номер чужой компании
    // известен, но доступа не даёт
    expect(() => platform.requireSameOrg(me!, strangerOrgId)).toThrow(PlatformError)
  })

  it('отзыв доступа обрывает все сессии человека сразу', async () => {
    const { userId } = await registerAndConfirm()
    const a = await platform.loginWithPassword({
      login: registration.email,
      password: registration.password,
      remember: true,
    })
    const b = await platform.loginWithPassword({
      login: registration.email,
      password: registration.password,
      remember: true,
    })
    await platform.revokeAllSessions(userId)

    expect(await platform.getSession(a.token)).toBeNull()
    expect(await platform.getSession(b.token)).toBeNull()
  })
})

describe('организация площадки', () => {
  it('может быть только одна — это держит база', async () => {
    await platform.createOrg({ legalForm: 'company', name: 'Площадка', isPlatform: true })
    await expect(
      platform.createOrg({ legalForm: 'company', name: 'Вторая', isPlatform: true }),
    ).rejects.toMatchObject({ code: 'platform_org_exists' })
  })
})

describe('совмещение ролей', () => {
  it('одна компания может и заказывать, и выполнять', async () => {
    const { orgId } = await registerAndConfirm()
    const org = await platform.enableContractorRole(orgId)
    expect(org.isClient).toBe(true)
    expect(org.isContractor).toBe(true)
  })
})

describe('точки клиента', () => {
  const site = {
    name: 'Кофейня на Тверской',
    address: 'Москва, Тверская 12, стр. 1',
    zoneCode: 'msk-cao',
  }

  async function ownerOf(overrides: Partial<typeof registration> = {}) {
    const { userId, orgId } = await registerAndConfirm(overrides)
    return { actor: await platform.getUser(userId), orgId }
  }

  const second = {
    companyName: 'Салон «Второй»',
    inn: '7707083893',
    email: 'boris@example.ru',
    phone: '+7 916 000-00-02',
    fullName: 'Борис Орлов',
  }

  it('клиент заводит вторую точку и видит обе', async () => {
    const { actor, orgId } = await ownerOf()

    await platform.addSite({ actor, orgId, ...site })
    await platform.addSite({
      actor,
      orgId,
      name: 'Кофейня на Пресне',
      address: 'Москва, Пресненская наб. 8',
      zoneCode: 'msk-cao',
    })

    const list = await platform.listSites(actor, orgId)
    expect(list.map((s) => s.name)).toEqual(['Кофейня на Тверской', 'Кофейня на Пресне'])
  })

  /**
   * Главный тест задачи. Чужая точка недоступна даже с верным идентификатором:
   * проверка принадлежности стоит в самой команде, а не на экране.
   */
  it('сотрудник одной компании не видит точки другой даже с идентификатором', async () => {
    const first = await ownerOf()
    const other = await ownerOf(second)

    const { id } = await platform.addSite({ actor: first.actor, orgId: first.orgId, ...site })

    expect((await rejection(platform.getSite(other.actor, id))).code).toBe('forbidden')
    expect((await rejection(platform.listSites(other.actor, first.orgId))).code).toBe('forbidden')
    expect(
      (
        await rejection(
          platform.updateSite({ actor: other.actor, siteId: id, ...site, name: 'Перехвачено' }),
        )
      ).code,
    ).toBe('forbidden')
    expect((await rejection(platform.archiveSite(other.actor, id))).code).toBe('forbidden')

    // И точка осталась нетронутой
    expect((await platform.getSite(first.actor, id)).name).toBe(site.name)
  })

  /**
   * Разница между «нет прав» и «не найдено» — это способ узнать, какие точки
   * есть у других: подставляя идентификаторы, чужой состав точек вычисляется
   * по разным ответам. Поэтому на несуществующую точку ответ свой.
   */
  it('на несуществующую точку отвечает «не найдено», а не «нет прав»', async () => {
    const { actor } = await ownerOf()
    const missing = '01a00000-0000-7000-8000-000000000000'
    expect((await rejection(platform.getSite(actor, missing))).code).toBe('site_not_found')
  })

  it('не принимает зону, которой нет в списке', async () => {
    const { actor, orgId } = await ownerOf()
    // Опечатка в коде зоны молча обнулила бы подбор: точка перестала бы
    // находиться подрядчиками, и никто бы не понял почему
    const error = await rejection(
      platform.addSite({ actor, orgId, ...site, zoneCode: 'МСК-ЦАО' }),
    )
    expect(error.code).toBe('bad_site')
  })

  it('не заводит вторую точку с тем же названием', async () => {
    const { actor, orgId } = await ownerOf()
    await platform.addSite({ actor, orgId, ...site })
    const error = await rejection(platform.addSite({ actor, orgId, ...site }))
    expect(error.code).toBe('site_name_taken')
  })

  it('то же название в другой компании — не помеха', async () => {
    const first = await ownerOf()
    const other = await ownerOf(second)
    await platform.addSite({ actor: first.actor, orgId: first.orgId, ...site })
    await expect(
      platform.addSite({ actor: other.actor, orgId: other.orgId, ...site }),
    ).resolves.toMatchObject({ name: site.name })
  })

  it('архивная точка уходит из списка, но остаётся доступной по ссылке', async () => {
    const { actor, orgId } = await ownerOf()
    const { id } = await platform.addSite({ actor, orgId, ...site })

    await platform.archiveSite(actor, id)

    expect(await platform.listSites(actor, orgId)).toEqual([])
    // На точку ссылаются заявки и сделки — она обязана остаться читаемой
    expect((await platform.getSite(actor, id)).archived).toBe(true)
    expect((await platform.listSites(actor, orgId, { includeArchived: true })).length).toBe(1)
  })

  it('освободившееся название можно занять заново', async () => {
    const { actor, orgId } = await ownerOf()
    const { id } = await platform.addSite({ actor, orgId, ...site })
    await platform.archiveSite(actor, id)

    await expect(platform.addSite({ actor, orgId, ...site })).resolves.toMatchObject({
      name: site.name,
    })
    // ...но вернуть архивную под занятым именем уже нельзя
    expect((await rejection(platform.restoreSite(actor, id))).code).toBe('site_name_taken')
  })

  /**
   * Кабинет показывает телефон человеческим видом, и он же приходит обратно,
   * когда точку правят. Значит показанный вид обязан приниматься на входе,
   * иначе правка чужого поля ломала бы форму на ровном месте.
   */
  it('принимает телефон в том виде, в каком сам его показывает', async () => {
    const { actor, orgId } = await ownerOf()
    const created = await platform.addSite({
      actor,
      orgId,
      ...site,
      contactPhone: '+7 916 111-22-33',
    })
    expect(created.contactPhone).toBe('+79161112233')

    const edited = await platform.updateSite({
      actor,
      siteId: created.id,
      ...site,
      contactPhone: '+7 916 111-22-33',
    })
    expect(edited.contactPhone).toBe('+79161112233')
  })

  it('телефон контакта на точке нормализуется, как и везде', async () => {
    const { actor, orgId } = await ownerOf()
    const created = await platform.addSite({
      actor,
      orgId,
      ...site,
      contactName: 'Ирина, администратор',
      contactPhone: '8 (916) 111-22-33',
    })
    expect(created.contactPhone).toBe('+79161112233')
  })
})

describe('реквизиты компании', () => {
  it('владелец правит название и КПП, сотрудник — нет', async () => {
    const { userId, orgId } = await registerAndConfirm()
    const owner = await platform.getUser(userId)

    const { userId: staffId } = await platform.inviteUser({
      actor: owner,
      orgId,
      email: 'staff@example.ru',
      phone: '+7 916 000-00-09',
      fullName: 'Пётр Смирнов',
      role: 'staff',
    })
    const staff = await platform.getUser(staffId)

    const updated = await platform.updateOrg({
      actor: owner,
      orgId,
      name: 'Кофейня «Пример» на Тверской',
      kpp: '770101001',
      legalAddress: 'Москва, Тверская 12',
    })
    expect(updated.name).toBe('Кофейня «Пример» на Тверской')
    expect(updated.kpp).toBe('770101001')

    expect(
      (await rejection(platform.updateOrg({ actor: staff, orgId, name: 'Чужое' }))).code,
    ).toBe('forbidden')
  })

  /**
   * ИНН через форму настроек не меняется намеренно: это то, по чему компанию
   * опознают и на что выписывают документы. Подмена ИНН сохранила бы всю
   * историю сделок и выплат за другим юрлицом.
   */
  it('ИНН реквизитами не меняется', async () => {
    const { userId, orgId } = await registerAndConfirm()
    const owner = await platform.getUser(userId)
    await platform.updateOrg({ actor: owner, orgId, name: 'Новое название' })
    expect((await platform.getOrg(orgId)).inn).toBe(registration.inn)
  })

  it('не принимает КПП неправильной длины', async () => {
    const { userId, orgId } = await registerAndConfirm()
    const owner = await platform.getUser(userId)
    const error = await rejection(
      platform.updateOrg({ actor: owner, orgId, name: 'Кофейня', kpp: '7701' }),
    )
    expect(error.code).toBe('bad_org')
  })

  it('показывает всех, у кого есть доступ к компании', async () => {
    const { userId, orgId } = await registerAndConfirm()
    const owner = await platform.getUser(userId)
    await platform.inviteUser({
      actor: owner,
      orgId,
      email: 'staff2@example.ru',
      phone: '+7 916 000-00-10',
      fullName: 'Ольга Титова',
      role: 'staff',
    })

    const people = await platform.listOrgUsers(owner, orgId)
    expect(people.map((p) => p.fullName)).toEqual(['Анна Ковалёва', 'Ольга Титова'])
  })
})

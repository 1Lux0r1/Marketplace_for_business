import { describe, expect, it } from 'vitest'
import type { Org, User } from '@/modules/platform'
import { existsSync } from 'node:fs'
import { sectionsFor, plannedFor, type Section } from './sections'

/**
 * §7.1 — главное правило информационной архитектуры проекта: разделы называются
 * задачами человека, а не сущностями системы. Там же прямо перечислено, чего
 * каждая роль не должна видеть никогда.
 *
 * Перечень, который нельзя проверить, при двух агентах не работает (§12).
 * Здесь он проверяется.
 */

const org = (over: Partial<Org> = {}): Org => ({
  id: 'o1',
  legalForm: 'company',
  name: 'Кофейня «Пример»',
  inn: '7701234567',
  kpp: '770101001',
  legalAddress: 'Москва, ул. Примерная, 1',
  isClient: true,
  isContractor: false,
  isPlatform: false,
  isActive: true,
  innVerifiedAt: null,
  innVerification: null,
  ...over,
})

const user = (over: Partial<User> = {}): User => ({
  id: 'u1',
  orgId: 'o1',
  email: 'anna@example.ru',
  emailVerified: true,
  phone: '+79161234567',
  phoneVerified: true,
  fullName: 'Анна Ковалёва',
  position: 'Директор',
  role: 'owner',
  isActive: true,
  ...over,
})

const labels = (sections: Section[]) => sections.map((s) => s.label)

describe('меню собирается из ролей (§7.1)', () => {
  it('заказчику запланированы свои четыре раздела', () => {
    expect(labels(plannedFor(org(), user()))).toEqual([
      'Найти услугу',
      'Мои заказы',
      'Документы и счета',
      'Компания',
    ])
  })

  it('подрядчик, который не заказывает, видит только свои разделы', () => {
    const sections = plannedFor(org({ isClient: false, isContractor: true }), user())
    expect(labels(sections)).toEqual([
      'Мои услуги',
      'Новые предложения',
      'Мои работы',
      'Закрыть акт',
      'Выплаты',
    ])
  })

  it('компания, которая и заказывает и выполняет, видит оба набора подряд', () => {
    const sections = plannedFor(org({ isContractor: true }), user())
    expect(labels(sections)).toEqual([
      'Найти услугу',
      'Мои заказы',
      'Документы и счета',
      'Компания',
      'Мои услуги',
      'Новые предложения',
      'Мои работы',
      'Закрыть акт',
      'Выплаты',
    ])
    // Группы идут подряд, а не вперемешку: черта в меню рисуется по смене группы
    expect(sections.map((s) => s.group)).toEqual([
      ...Array<string>(4).fill('client'),
      ...Array<string>(5).fill('contractor'),
    ])
  })

  it('сотрудник площадки видит разделы оператора, а не разделы компании', () => {
    const staff = org({ isPlatform: true, isClient: false, name: 'Площадка' })
    expect(labels(plannedFor(staff, user({ role: 'operator' })))).toEqual([
      'Очередь',
      'Сделки',
      'Подрядчики',
      'Споры',
      'Метрики',
    ])
  })

  it('незашедший видит витрину: каталог — основной путь (§1)', () => {
    expect(labels(plannedFor(null, null))).toContain('Найти услугу')
  })

  it('у каждого раздела свой адрес: два пункта на один экран — ошибка', () => {
    const all = plannedFor(org({ isContractor: true }), user())
    const hrefs = all.map((s) => s.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  // Раздел без иконки тестом не проверяется, и это не пробел: `icon` объявлен
  // как имя из реестра, поэтому раздел с несуществующей иконкой не собирается —
  // `pnpm typecheck` ловит это строже и раньше, чем поймал бы тест.
})

/**
 * Списки взяты из таблицы §7.1 дословно, колонка «Никогда не видит».
 * Оператору системные термины можно — он их знает, и это там оговорено.
 */
const forbidden: Array<[string, Org, string[]]> = [
  [
    'заказчику',
    org(),
    ['каталог позиций', 'заявк', 'сделк', 'сущност', 'реестр'],
  ],
  [
    'подрядчику',
    org({ isClient: false, isContractor: true }),
    ['листинг', 'матчинг', 'оффер', 'пайаут'],
  ],
]

describe('системные термины не протекают в меню (§7.1)', () => {
  it.each(forbidden)('%s таких слов не показываем', (_who, company, words) => {
    const menu = labels(plannedFor(company, user())).join(' · ').toLowerCase()
    const leaked = words.filter((word) => menu.includes(word))
    expect(leaked, `в меню протекло: ${leaked.join(', ')} — «${menu}»`).toEqual([])
  })

  it('в меню нет английских слов: интерфейс на русском (§6)', () => {
    const menu = labels(plannedFor(org({ isContractor: true }), user())).join(' ')
    expect(menu).not.toMatch(/[A-Za-z]/)
  })
})

/**
 * Пункт меню, ведущий на несуществующий экран, — сломанный интерфейс: человек
 * нажимает и попадает на страницу ошибки. Раздел показывается только когда
 * его экран готов, и это держится здесь, а не на памяти.
 *
 * Проверка смотрит на файлы страниц, а не на список в коде: список можно
 * поправить и забыть, файл — нет.
 */
describe('меню не ведёт в никуда', () => {
  const everyone = [
    sectionsFor(org({ isContractor: true }), user()),
    sectionsFor(org({ isPlatform: true, isClient: false }), user({ role: 'operator' })),
    sectionsFor(null, null),
  ].flat()

  it('показываем хоть что-то: пустое меню — тоже поломка', () => {
    expect(everyone.length).toBeGreaterThan(0)
  })

  it.each([...new Set(everyone.map((s) => s.href))])('за %s есть экран', (href) => {
    const page = new URL(`.${href}/page.tsx`, import.meta.url)
    expect(existsSync(page), `нет файла экрана для ${href}`).toBe(true)
  })

  it('неготовые разделы описаны, но не показаны', () => {
    const planned = plannedFor(org({ isContractor: true }), user())
    const shown = sectionsFor(org({ isContractor: true }), user())
    expect(planned.length).toBeGreaterThan(shown.length)
  })
})

import type { Org, User } from '@/modules/platform'
import type { IconName } from '@/ui/icons'

/**
 * Разделы меню. Названы задачами человека, а не сущностями системы (§7.1) —
 * это главное правило информационной архитектуры проекта, и оно проверяется
 * тестом `sections.test.ts`, а не держится на внимательности.
 *
 * Меню собирается из ролей, а не зашито. Одна компания может и заказывать,
 * и выполнять (`docs/12-auth-ux.md`), поэтому «клиент» и «подрядчик» —
 * не выбор из двух, а два набора, которые складываются.
 *
 * Решением от 06.09.2026 меню одно на всё, без переключателя режима. Цена
 * решения: у компании, которая делает и то и другое, пунктов девять, и в строку
 * они не помещаются. Поэтому группы разделены чертой, а активный пункт
 * доводится до видимой части — см. `nav.tsx`.
 */
export type Group = 'client' | 'contractor' | 'staff'

export type Section = {
  href: string
  label: string
  /**
   * Экран за разделом уже существует.
   *
   * Пункт меню, ведущий в никуда, — это не «задел на будущее», а сломанный
   * интерфейс: человек нажимает и попадает на страницу ошибки. Поэтому
   * неготовые разделы в меню не показываются, хотя и описаны здесь — так
   * видно, куда система растёт, и пункт включается вместе со своей задачей.
   *
   * Проверяется тестом: у каждого показанного раздела есть свой экран.
   */
  ready?: boolean
  /** Имя иконки из реестра `src/ui/icons.tsx`, а не сам рисунок: этот файл —
      знание о предметной области, и он не должен зависеть от разметки. */
  icon: IconName
  group: Group
  /** Счётчик рядом с названием. Ноль не показывается. */
  count?: number
}

/** Заказчик: выбирает услугу, следит за заказом, платит, принимает работу. */
const client: Section[] = [
  { href: '/catalog', label: 'Найти услугу', icon: 'search', group: 'client', ready: true },
  { href: '/orders', label: 'Мои заказы', icon: 'bag', group: 'client' },
  { href: '/documents', label: 'Документы и счета', icon: 'doc', group: 'client' },
  { href: '/company', label: 'Компания', icon: 'building', group: 'client', ready: true },
]

/** Подрядчик: публикует карточки, отвечает на предложения, закрывает работы. */
const contractor: Section[] = [
  { href: '/services', label: 'Мои услуги', icon: 'tag', group: 'contractor' },
  { href: '/offers', label: 'Новые предложения', icon: 'inbox', group: 'contractor' },
  { href: '/works', label: 'Мои работы', icon: 'tool', group: 'contractor' },
  { href: '/acts', label: 'Закрыть акт', icon: 'checkDoc', group: 'contractor' },
  { href: '/payouts', label: 'Выплаты', icon: 'wallet', group: 'contractor' },
]

/** Оператор: разбирает очередь и гасит споры. Системные термины ему можно (§7.1). */
const operator: Section[] = [
  // Очередь оператора — это очередь проверки регистраций: пока справочник
  // компаний не подключён (Q20), в неё попадает каждая новая. Появятся другие
  // очереди — раздел станет общим, а адрес переедет на `/queue`.
  {
    href: '/operator/verification',
    label: 'Очередь',
    icon: 'inbox',
    group: 'staff',
    ready: true,
  },
  { href: '/deals', label: 'Сделки', icon: 'deal', group: 'staff' },
  { href: '/operator/contractors', label: 'Подрядчики', icon: 'users', group: 'staff', ready: true },
  { href: '/disputes', label: 'Споры', icon: 'alert', group: 'staff' },
  { href: '/metrics', label: 'Метрики', icon: 'chart', group: 'staff' },
]

/**
 * Что видит человек. Ничего не знает про экраны — только про роли,
 * поэтому проверяется без базы и без браузера.
 *
 * Никого не вошло — показываем витрину: незарегистрированный человек пришёл
 * смотреть каталог, это основной путь (§1).
 *
 * ДОПУЩЕНИЕ (Q21): администратору §7.1 пунктов меню не задаёт, а свои экраны
 * у него появляются только в спринте 03. До тех пор он видит меню оператора —
 * иначе сотрудник площадки с правами администратора не видит вообще ничего.
 * Заменяется, когда админка будет спроектирована.
 */
export function sectionsFor(org: Org | null, user: User | null): Section[] {
  return plannedFor(org, user).filter((section) => section.ready)
}

/**
 * Все разделы роли, включая те, чьих экранов ещё нет. Нужен плану и тестам:
 * по нему видно, куда система растёт, и он же следит, чтобы название раздела
 * не съехало в системный термин раньше, чем экран появится.
 */
export function plannedFor(org: Org | null, user: User | null): Section[] {
  if (!org || !user) return client

  if (org.isPlatform) return operator

  return [...(org.isClient ? client : []), ...(org.isContractor ? contractor : [])]
}

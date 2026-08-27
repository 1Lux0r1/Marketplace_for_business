'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cx } from '@/ui'
import { SearchIcon, BagIcon, DocIcon, BuildingIcon, LockIcon } from '@/ui/icons'

/**
 * Разделы названы задачами пользователя, а не сущностями системы (§7.1).
 * «Каталог позиций», «Заявки», «Сделки», «Реестр» здесь появиться не могут.
 *
 * Меню горизонтальное, под поиском, во всю ширину — по утверждённым макетам
 * в `design/`. Активный раздел: бирюзовый текст и бирюзовое подчёркивание.
 */
const sections = [
  { href: '/', label: 'Найти услугу', Icon: SearchIcon, count: 0 },
  { href: '/orders', label: 'Мои заказы', Icon: BagIcon, count: 0 },
  { href: '/documents', label: 'Документы и счета', Icon: DocIcon, count: 0 },
  { href: '/company', label: 'Компания', Icon: BuildingIcon, count: 0 },
] as const

export function Nav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Основные разделы"
      className="flex items-center gap-6 overflow-x-auto border-t border-line px-4 md:gap-9 md:px-10"
    >
      {sections.map(({ href, label, Icon, count }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'inline-flex h-[58px] items-center gap-2.5 whitespace-nowrap text-body',
              active
                ? 'font-bold text-accent-strong shadow-[inset_0_-2px_0_0_var(--accent)]'
                : 'font-medium text-ink-2 hover:text-ink',
            )}
          >
            <Icon size={19} />
            <span>{label}</span>
            {count > 0 && (
              <span
                className={cx(
                  'num rounded-pill px-2 py-0.5 text-label font-extrabold',
                  active ? 'bg-accent text-on-accent' : 'bg-surface-3 text-ink-2',
                )}
              >
                {count}
              </span>
            )}
          </Link>
        )
      })}
      <span className="ml-auto hidden items-center gap-2 whitespace-nowrap text-caption text-ink-3 lg:inline-flex">
        <LockIcon size={15} />
        Деньги под защитой сделки
      </span>
    </nav>
  )
}

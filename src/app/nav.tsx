'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { cx } from '@/ui'
import { LockIcon, icons } from '@/ui/icons'
import type { Section } from './sections'

/**
 * Меню разделов: горизонтальное, под поиском, во всю ширину — по утверждённым
 * макетам в `design/`. Активный раздел: бирюзовый текст и подчёркивание.
 *
 * Меню одно на всё, без переключателя режима (решение от 06.09.2026). У компании,
 * которая и заказывает, и выполняет, пунктов девять, и в строку они не влезают.
 * Отсюда две вещи, без которых это решение работало бы плохо:
 *
 * 1. Между группами стоит черта. Иначе «Компания» и «Мои услуги» читаются как
 *    соседи по смыслу, хотя это разные половины жизни компании на площадке.
 * 2. Активный пункт доводится до видимой части при открытии страницы. §7.1
 *    требует, чтобы с любого экрана было видно, где ты находишься; в прокрученной
 *    строке активный пункт иначе оказывается за краем и это требование ломается.
 *
 * Прокрутка строки — это прокрутка самой строки, а не страницы: страница
 * не должна ехать вбок никогда (§7.5).
 */
export function Nav({ sections }: { sections: Section[] }) {
  const pathname = usePathname()
  const active = useRef<HTMLAnchorElement>(null)

  // Доводим активный пункт до видимой части. `block: 'nearest'` — чтобы
  // страница при этом не подпрыгивала по вертикали.
  useEffect(() => {
    active.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [pathname])

  return (
    <nav
      aria-label="Основные разделы"
      className="flex items-center gap-6 overflow-x-auto border-t border-line px-4 md:gap-9 md:px-10"
    >
      {sections.map((section, i) => {
        const { href, label, count = 0, group } = section
        const Icon = icons[section.icon]
        // Совпадение точное или по вложенному адресу. Просто `startsWith` метил бы
        // «Мои услуги» активным на «/services-archive» — правка второго агента
        const isActive = pathname === href || pathname.startsWith(`${href}/`)
        const startsGroup = i > 0 && sections[i - 1]!.group !== group

        return (
          <div key={href} className="flex items-center gap-6 md:gap-9">
            {startsGroup && (
              <span aria-hidden className="h-6 w-px flex-none bg-line" />
            )}
            <Link
              ref={isActive ? active : undefined}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={cx(
                'inline-flex h-[58px] items-center gap-2.5 whitespace-nowrap text-body',
                isActive
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
                    isActive ? 'bg-accent text-on-accent' : 'bg-surface-3 text-ink-2',
                  )}
                >
                  {count}
                </span>
              )}
            </Link>
          </div>
        )
      })}
      <span className="ml-auto hidden items-center gap-2 whitespace-nowrap text-caption text-ink-3 lg:inline-flex">
        <LockIcon size={15} />
        Деньги под защитой сделки
      </span>
    </nav>
  )
}

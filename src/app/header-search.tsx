'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SearchIcon } from '@/ui/icons'

/**
 * Поиск в шапке.
 *
 * Он не ищет сам, и это намеренно. Настоящий поиск живёт на витрине вместе
 * с категорией и расширенными настройками — там же, где показывается результат.
 * Две строки поиска на одном экране были ошибкой: человек не знает, какая
 * из них главная, и половина попадёт в нерабочую.
 *
 * Поэтому здесь одна строка на всё приложение, и ведёт она себя так:
 *
 * - на любом экране, кроме витрины, это ссылка вида поля. Нажал — попал
 *   на витрину, курсор уже в настоящей строке поиска. Визуально поле
 *   «съезжает» из шапки вниз, на своё рабочее место;
 * - на самой витрине она сворачивается в значок: настоящая строка уже
 *   на экране, и дублировать её нечем.
 *
 * `#search` в адресе — это не украшение: по нему настоящее поле получает
 * фокус, и переход остаётся одним нажатием, без единой строки на стороне
 * браузера сверх этой.
 */
export function HeaderSearch() {
  const pathname = usePathname()
  const onStorefront = pathname === '/'

  if (onStorefront) {
    return (
      <a
        href="#search"
        aria-label="К строке поиска"
        className="flex size-11 flex-none items-center justify-center rounded-pill text-ink-2 hover:bg-surface-2 hover:text-ink"
      >
        <SearchIcon size={20} />
      </a>
    )
  }

  return (
    <Link
      href="/#search"
      className="flex h-11 min-w-0 max-w-[620px] flex-1 items-center gap-3 rounded-pill border border-line-strong bg-surface-2 px-4 text-ink-2 transition-colors duration-150 hover:border-accent hover:text-ink"
    >
      <SearchIcon size={19} />
      <span className="truncate text-body">Что нужно сделать на точке?</span>
    </Link>
  )
}

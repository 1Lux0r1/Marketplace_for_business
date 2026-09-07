'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { cx } from './cx'

/**
 * Чип фильтра: категория, зона, срок выезда.
 *
 * Кнопка, а не ссылка со стилем кнопки: чип включает и выключает признак,
 * а не ведёт на другой экран. Нажатое состояние читается вслух через
 * `aria-pressed`, а не только цветом — цвет не единственный носитель
 * смысла (§7.2).
 *
 * Высота 44 px: это минимальная целевая область, и пальцем в 28-пиксельный
 * чип не попасть (§7.5).
 *
 * С `href` становится ссылкой. Фильтры витрины живут в адресе, а не в памяти
 * страницы: так фильтр переживает обновление, его можно переслать и вернуться
 * к нему кнопкой «назад». Ссылка ещё и работает без единой строки на стороне
 * браузера, что для витрины важно — её открывают с телефона в перерыве.
 */
export function Chip({
  children,
  selected = false,
  onClick,
  href,
  count,
}: {
  children: ReactNode
  selected?: boolean
  onClick?: () => void
  /** Чип-ссылка: фильтр меняет адрес, а не состояние страницы. */
  href?: string
  count?: number
}) {
  const body = (
    <>
      {children}
      {count !== undefined && <span className="num text-ink-3">{count}</span>}
    </>
  )

  const look = cx(
        'inline-flex min-h-11 items-center gap-2 rounded-pill border px-4 text-table transition-colors duration-150',
        selected
          ? 'border-accent bg-accent-tint font-bold text-accent-strong'
          : 'border-line-strong bg-surface font-medium text-ink-2 hover:bg-surface-2 hover:text-ink',
  )

  // У ссылки «выбран» передаётся через aria-current: aria-pressed — про кнопку,
  // и на ссылке чтение с экрана его не поймёт
  if (href) {
    return (
      <Link href={href} aria-current={selected ? 'true' : undefined} className={look}>
        {body}
      </Link>
    )
  }

  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className={look}>
      {body}
    </button>
  )
}

/**
 * Строка фильтров с кнопкой сброса.
 *
 * Сброс появляется только когда есть что сбрасывать, и это не украшение:
 * §7.4 требует, чтобы пустой результат фильтра объяснял, что изменить,
 * и содержал кнопку. Половина этого обещания живёт здесь.
 */
export function FilterBar({
  children,
  onReset,
  resultLabel,
}: {
  children: ReactNode
  onReset?: () => void
  /** «Показано 24 из 138» — человек должен видеть, сколько фильтр отрезал. */
  resultLabel?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">{children}</div>
      {(resultLabel || onReset) && (
        <div className="flex flex-wrap items-center gap-4 text-caption text-ink-3">
          {resultLabel && <span className="num">{resultLabel}</span>}
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="min-h-11 font-semibold text-accent-strong hover:text-accent"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      )}
    </div>
  )
}

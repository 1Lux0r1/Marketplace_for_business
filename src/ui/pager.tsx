'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { cx } from './cx'

/**
 * Разбивка длинного списка.
 *
 * Ссылками, а не кнопкой «показать ещё»: у оператора список подрядчиков —
 * рабочий инструмент, к которому возвращаются. Ссылка на третью страницу
 * открывается снова и переживает обновление, накопленный «показать ещё» — нет.
 *
 * Показываем не только номера, но и сколько всего: «31–60 из 138» отвечает
 * на вопрос «долго ли ещё листать», а голые номера — нет.
 *
 * Граница ожидания внутри — по той же причине, что и у вкладок: чтение адреса
 * без неё роняет статическую сборку, и разбираться с этим должен примитив,
 * а не каждый экран со списком.
 */
export function Pager(props: {
  page: number
  perPage: number
  total: number
  param?: string
}) {
  if (props.total <= props.perPage) return null
  return (
    <Suspense fallback={<div className="h-11" aria-hidden />}>
      <PagerInner {...props} />
    </Suspense>
  )
}

function PagerInner({
  page,
  perPage,
  total,
  param = 'page',
}: {
  /** Текущая страница, считая с единицы. */
  page: number
  perPage: number
  total: number
  param?: string
}) {
  const pathname = usePathname()
  const search = useSearchParams()
  const pages = Math.max(1, Math.ceil(total / perPage))

  if (pages <= 1) return null

  const from = (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)

  function hrefFor(target: number): string {
    const next = new URLSearchParams(search.toString())
    next.set(param, String(target))
    return `${pathname}?${next.toString()}`
  }

  const step = (label: string, target: number, disabled: boolean) =>
    disabled ? (
      <span
        aria-disabled="true"
        className="inline-flex min-h-11 items-center rounded-control px-3.5 text-table font-semibold text-ink-3 opacity-50"
      >
        {label}
      </span>
    ) : (
      <Link
        href={hrefFor(target)}
        className="inline-flex min-h-11 items-center rounded-control border border-line-strong px-3.5 text-table font-semibold text-ink hover:bg-surface-2"
      >
        {label}
      </Link>
    )

  return (
    <nav
      aria-label="Страницы списка"
      className="flex flex-wrap items-center justify-between gap-3 pt-1"
    >
      <span className={cx('num text-caption text-ink-3')}>
        {from}–{to} из {total}
      </span>
      <div className="flex items-center gap-2">
        {step('Назад', page - 1, page <= 1)}
        <span className="num px-1 text-table text-ink-2">
          {page} из {pages}
        </span>
        {step('Дальше', page + 1, page >= pages)}
      </div>
    </nav>
  )
}

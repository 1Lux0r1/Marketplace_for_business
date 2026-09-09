'use client'

import { useState } from 'react'
import { Button, Select, cx } from '@/ui'
import { formatKopecks } from '@/shared/money'
import type { Category, Zone } from '@/modules/catalog'

/**
 * Поиск и фильтры витрины.
 *
 * Одна форма на всё. Раньше поиск был отдельной формой, а категория и зона —
 * двумя рядами чипов: двадцать шесть чипов занимали пол-экрана до того, как
 * человек увидел первую карточку. Теперь строка поиска, категория списком,
 * и всё остальное — под «Расширенным поиском», закрытым по умолчанию.
 *
 * Форма отправляется целиком и обычным способом, поэтому фильтр живёт в адресе:
 * его можно переслать, вернуться к нему кнопкой «назад» и обновить страницу,
 * ничего не потеряв. Ползунок цены при этом показывает значение сразу — это
 * единственное, ради чего здесь нужен браузер.
 *
 * «Расширенный поиск» открыт, если внутри него что-то выбрано: иначе человек
 * не увидит, почему список короткий, и решит, что услуг просто нет.
 */
type Current = {
  category?: string | undefined
  zone?: string | undefined
  q?: string | undefined
  priceTo?: string | undefined
}

export function Filters({
  categories,
  zones,
  current,
  maxPriceKopecks,
}: {
  categories: Category[]
  zones: Zone[]
  current: Current
  /** Верх ползунка — самая дорогая карточка на витрине, а не выдуманное число. */
  maxPriceKopecks: bigint
}) {
  const ceiling = Number(maxPriceKopecks)
  const [priceTo, setPriceTo] = useState(() =>
    current.priceTo ? Number(current.priceTo) : ceiling,
  )
  const advancedUsed = Boolean(current.zone ?? current.priceTo)
  const [open, setOpen] = useState(advancedUsed)

  return (
    <form action="/" className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[16rem] flex-1">
          <span className="sr-only">Поиск по услугам</span>
          <input
            id="search"
            name="q"
            defaultValue={current.q ?? ''}
            placeholder="Что нужно сделать на точке?"
            className="h-13 w-full rounded-pill border-2 border-accent bg-surface px-5 text-lead text-ink placeholder:text-ink-3"
          />
        </label>

        <div className="min-w-[13rem] flex-1 sm:max-w-[18rem]">
          <Select
            label="Категория"
            name="category"
            defaultValue={current.category ?? ''}
            options={[
              { value: '', label: 'Все категории' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>

        <Button type="submit" size="lg">
          Найти
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex min-h-11 items-center gap-2 text-body font-semibold text-accent-strong hover:text-accent"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={cx('transition-transform duration-150', open && 'rotate-180')}
          >
            <path d="M6 9.5l6 6 6-6" />
          </svg>
          Расширенный поиск
        </button>

        {advancedUsed && (
          <a
            href="/"
            className="inline-flex min-h-11 items-center text-caption font-semibold text-ink-3 hover:text-ink"
          >
            Сбросить всё
          </a>
        )}
      </div>

      {/* Скрытая часть остаётся в разметке: иначе выбранное в ней пропадёт
          из отправки, стоит человеку её свернуть */}
      <div
        hidden={!open}
        className="grid gap-5 rounded-card border border-line bg-surface-2 p-5 sm:grid-cols-2"
      >
        <Select
          label="Территория"
          name="zone"
          defaultValue={current.zone ?? ''}
          options={[
            { value: '', label: 'Вся Москва' },
            ...zones.map((z) => ({ value: z.code, label: z.name })),
          ]}
          hint="Показываем тех, кто выезжает в выбранный округ"
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="price-to" className="text-table font-semibold text-ink">
            Цена до{' '}
            <span className="num text-accent-strong">{formatKopecks(BigInt(priceTo))}</span>
          </label>
          <input
            id="price-to"
            name="priceTo"
            type="range"
            min={0}
            max={ceiling}
            step={10_000}
            value={priceTo}
            onChange={(e) => setPriceTo(Number(e.target.value))}
            className="h-11 w-full accent-[var(--accent)]"
          />
          <p className="num text-caption text-ink-3">
            от {formatKopecks(0n)} до {formatKopecks(maxPriceKopecks)} — вся витрина
          </p>
        </div>
      </div>
    </form>
  )
}

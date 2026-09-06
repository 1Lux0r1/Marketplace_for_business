'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { cx } from './cx'

/**
 * Переключение между наборами одного списка: черновики, на модерации,
 * опубликованные, снятые.
 *
 * Это ссылки, а не переключатель на странице. Так состояние живёт в адресе:
 * подрядчик может дать ссылку на «мои отклонённые», вернуться назад кнопкой
 * браузера и обновить страницу, не потеряв, что смотрел. Кнопка, меняющая
 * состояние в памяти, всего этого не умеет.
 *
 * Счётчик обязателен там, где он есть: «На модерации 3» отвечает на вопрос
 * «что мне делать сейчас» до того, как человек туда зайдёт (§7.1).
 *
 * Чтение адреса Next разрешает только внутри границы ожидания, иначе
 * статическая сборка падает. Граница стоит здесь, а не у того, кто ставит
 * вкладки на экран: примитив, который ломает сборку, если о нём не вспомнить,
 * будет ломать её регулярно. Заглушка повторяет форму вкладок, чтобы страница
 * не подпрыгивала при подстановке (§7.4).
 */
export type Tab = { value: string; label: string; count?: number }

export function Tabs(props: {
  tabs: Tab[]
  param?: string
  current?: string
}) {
  return (
    <Suspense fallback={<TabsSkeleton count={props.tabs.length} />}>
      <TabsInner {...props} />
    </Suspense>
  )
}

function TabsSkeleton({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1 border-b border-line" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="my-2.5 mx-3.5 block h-4 w-24 rounded bg-skeleton" />
      ))}
    </div>
  )
}

function TabsInner({
  tabs,
  param = 'status',
  current,
}: {
  tabs: Tab[]
  /** Имя признака в адресе. По умолчанию `status`. */
  param?: string
  /** Что выбрано сейчас. Не задано — берём из адреса, иначе первый. */
  current?: string
}) {
  const pathname = usePathname()
  const search = useSearchParams()
  const active = current ?? search.get(param) ?? tabs[0]?.value

  return (
    <nav aria-label="Что показывать" className="overflow-x-auto">
      <ul className="flex min-w-max items-center gap-1 border-b border-line">
        {tabs.map((tab) => {
          const isActive = tab.value === active
          const next = new URLSearchParams(search.toString())
          next.set(param, tab.value)

          return (
            <li key={tab.value}>
              <Link
                href={`${pathname}?${next.toString()}`}
                aria-current={isActive ? 'page' : undefined}
                className={cx(
                  'inline-flex min-h-11 items-center gap-2 whitespace-nowrap px-3.5 text-body',
                  isActive
                    ? 'font-bold text-accent-strong shadow-[inset_0_-2px_0_0_var(--accent)]'
                    : 'font-medium text-ink-2 hover:text-ink',
                )}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={cx(
                      'num rounded-pill px-2 py-0.5 text-label font-extrabold',
                      isActive ? 'bg-accent text-on-accent' : 'bg-surface-3 text-ink-2',
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

import type { ReactNode } from 'react'
import { cx } from './cx'

/**
 * Таблица всегда внутри контейнера с горизонтальной прокруткой: страница
 * не должна прокручиваться вбок никогда (§7.5).
 *
 * Суммы и даты выравниваются вправо и набираются табличными цифрами
 * одинаково во всех таблицах системы (§7.3).
 */
export function TableFrame({ children, minWidth = 'min-w-[720px]' }: { children: ReactNode; minWidth?: string }) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
      <table className={cx('w-full border-collapse', minWidth)}>{children}</table>
    </div>
  )
}

export function Th({ children, numeric = false }: { children: ReactNode; numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cx(
        'px-4 py-3 text-label font-bold tracking-[0.08em] text-ink-3 uppercase',
        numeric ? 'text-right' : 'text-left',
      )}
    >
      {children}
    </th>
  )
}

export function Td({ children, numeric = false }: { children: ReactNode; numeric?: boolean }) {
  return (
    <td
      className={cx(
        'border-t border-line px-4 py-3 text-table text-ink-2',
        numeric ? 'num text-right whitespace-nowrap' : 'text-left',
      )}
    >
      {children}
    </td>
  )
}

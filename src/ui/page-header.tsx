import type { ReactNode } from 'react'
import Link from 'next/link'
import { cx } from './cx'

/**
 * Шапка экрана: где ты находишься, что это за экран и какое действие главное.
 *
 * Правило трёх кликов не работает; работает другое — с любого экрана видно,
 * где ты и что делать дальше (§7.1). Поэтому здесь три вещи и ровно в таком
 * порядке: путь, заголовок, главное действие.
 *
 * **Главное действие ровно одно.** Тип это и держит: `action` — один узел,
 * а не список. Если действий два, экран спроектирован неправильно (§7.1) —
 * второе уходит в `secondary` и рисуется слабее.
 */
type Crumb = { href: string; label: string }

type Props = {
  title: string
  /** Одна строка под заголовком: что это за экран и зачем. Не пересказ названия. */
  description?: ReactNode
  /** Путь до экрана. Последним идёт текущий экран — он не ссылка. */
  breadcrumbs?: Crumb[]
  /** Главное действие. Одно. */
  action?: ReactNode
  /** Второстепенные действия: рисуются слабее главного и правее него. */
  secondary?: ReactNode
}

export function PageHeader({ title, description, breadcrumbs, action, secondary }: Props) {
  return (
    <header className="flex flex-col gap-3">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Где вы находитесь">
          <ol className="flex flex-wrap items-center gap-2 text-caption text-ink-3">
            {breadcrumbs.map((crumb, i) => {
              const last = i === breadcrumbs.length - 1
              return (
                <li key={crumb.href} className="flex items-center gap-2">
                  {i > 0 && <span aria-hidden>/</span>}
                  {last ? (
                    <span aria-current="page" className="text-ink-2">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link href={crumb.href} className="text-accent-strong hover:text-accent">
                      {crumb.label}
                    </Link>
                  )}
                </li>
              )
            })}
          </ol>
        </nav>
      )}

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-page font-extrabold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-2 max-w-[66ch] text-body text-ink-2">{description}</p>
          )}
        </div>

        {(action || secondary) && (
          <div className="flex flex-none flex-wrap items-center gap-3">
            {secondary}
            {action}
          </div>
        )}
      </div>
    </header>
  )
}

/**
 * Рабочая область экрана: одна колонка с одинаковыми отступами между блоками.
 *
 * Существует, чтобы плотность §7.3 задавалась в одном месте, а не подбиралась
 * на каждом экране заново. Витрина живёт по своим правилам и это не использует.
 */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('flex min-w-0 flex-col gap-5', className)}>{children}</div>
}

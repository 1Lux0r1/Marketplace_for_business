import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Nav } from './nav'
import { SearchIcon } from '@/ui/icons'
import './globals.css'

export const metadata: Metadata = {
  title: 'Маркетплейс для бизнеса',
  description: 'Услуги и товары для бизнеса с полным сопровождением сделки',
}

/**
 * Базовый макет: шапка с поиском, горизонтальное меню под ней во всю ширину,
 * контентная область без боковой колонки (макеты в `design/`).
 *
 * Обращаемся к человеку, а не к юрлицу (§7): в шапке имя, а не ИНН.
 * Имя пока зашито — сессии появятся в 01-2.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="flex min-h-screen flex-col bg-bg text-ink">
        <header className="flex-none border-b border-line bg-surface">
          <div className="flex h-[68px] items-center gap-4 px-4 md:gap-7 md:px-10">
            <div className="flex flex-none items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-[10px] bg-accent text-lead font-extrabold text-on-accent">
                М
              </div>
              {/* На узком экране остаётся только знак: строка целиком не помещается
                  и утаскивала бы страницу вбок (§7.5) */}
              <span className="hidden text-lead font-extrabold whitespace-nowrap sm:inline">
                Маркетплейс&nbsp;для&nbsp;бизнеса
              </span>
            </div>

            <div className="flex h-11 min-w-0 max-w-[620px] flex-1 items-center gap-3 rounded-pill border border-line bg-surface-2 px-4 text-ink-3">
              <SearchIcon size={19} />
              <span className="truncate text-body">Что нужно сделать на точке?</span>
            </div>

            <div className="ml-auto flex flex-none items-center gap-3">
              <div className="hidden text-right leading-tight md:block">
                <div className="text-table font-bold">Анна Ковалёва</div>
                <div className="text-caption text-ink-3">Кофейня «Пример» · Пятницкая, 41</div>
              </div>
              <div className="flex size-9.5 items-center justify-center rounded-full bg-accent text-table font-extrabold text-on-accent">
                АК
              </div>
            </div>
          </div>
          <Nav />
        </header>

        <main className="flex min-w-0 flex-1 flex-col gap-6 px-4 pt-8 pb-11 md:px-10">{children}</main>
      </body>
    </html>
  )
}

import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Nav } from './nav'
import { AuthButtons } from './auth/auth-buttons'
import { UserMenu } from './auth/user-menu'
import { currentUser, currentOrg } from '@/server/session'
import { sectionsFor } from './sections'
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
 *
 * Кто вошёл — решается на сервере по куке: незашедший видит две кнопки,
 * зашедший — своё имя. В браузер разметка приходит уже правильной.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await currentUser()
  const org = user ? await currentOrg(user) : null
  // Меню собирается из ролей компании, а не зашито: одна компания может
  // и заказывать, и выполнять (§7.1, `sections.ts`)
  const sections = sectionsFor(org, user)

  return (
    <html lang="ru">
      <body className="flex min-h-screen flex-col bg-bg text-ink">
        <header className="flex-none border-b border-line bg-surface">
          <div className="flex h-[68px] items-center gap-4 px-4 md:gap-7 md:px-10">
            <div className="flex flex-none items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-control bg-accent text-lead font-extrabold text-on-accent">
                М
              </div>
              {/* На узком экране остаётся только знак: строка целиком не помещается
                  и утаскивала бы страницу вбок (§7.5) */}
              <span className="hidden text-lead font-extrabold whitespace-nowrap sm:inline">
                Маркетплейс&nbsp;для&nbsp;бизнеса
              </span>
            </div>

            <div className="flex h-11 min-w-0 max-w-[620px] flex-1 items-center gap-3 rounded-pill border border-line-strong bg-surface-2 px-4 text-ink-3">
              <SearchIcon size={19} />
              <span className="truncate text-body">Что нужно сделать на точке?</span>
            </div>

            <div className="ml-auto flex flex-none items-center gap-3">
              {user ? (
                <UserMenu fullName={user.fullName} orgName={org?.name ?? ''} />
              ) : (
                <AuthButtons />
              )}
            </div>
          </div>
          <Nav sections={sections} />
        </header>

        <main className="flex min-w-0 flex-1 flex-col gap-6 px-4 pt-8 pb-11 md:px-10">{children}</main>
      </body>
    </html>
  )
}

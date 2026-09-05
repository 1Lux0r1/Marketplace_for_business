'use client'

import { useTransition } from 'react'
import { logoutAction } from '@/server/auth-actions'

/**
 * Кто вошёл. Обращаемся к человеку, а не к юрлицу (§7): имя, а не ИНН.
 *
 * «Выйти» — видимая кнопка, а не пункт, появляющийся при наведении:
 * на тач-устройствах наведения нет (§7.5).
 */
export function UserMenu({ fullName, orgName }: { fullName: string; orgName: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-none items-center gap-3">
      <div className="hidden text-right leading-tight md:block">
        <div className="text-table font-bold">{fullName}</div>
        <div className="text-caption text-ink-3">{orgName}</div>
      </div>
      <div className="flex size-9.5 items-center justify-center rounded-full bg-accent text-table font-extrabold text-on-accent">
        {initials(fullName)}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => void (await logoutAction()))}
        className="hidden h-11 items-center px-2 text-table font-semibold text-ink-2 hover:text-ink disabled:opacity-50 sm:inline-flex"
      >
        Выйти
      </button>
    </div>
  )
}

function initials(fullName: string): string {
  return fullName
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

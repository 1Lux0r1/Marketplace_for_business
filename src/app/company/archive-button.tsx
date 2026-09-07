'use client'

import { useState, useTransition } from 'react'
import { archiveSiteAction } from '@/server/company-actions'

/**
 * Убрать точку или вернуть её.
 *
 * Слово «убрать», а не «удалить», и это честно: точка остаётся в базе, потому
 * что на неё ссылаются заявки и сделки. Написать «удалить» и не удалить —
 * значит соврать в интерфейсе.
 *
 * Подтверждения нет намеренно: действие обратимо той же кнопкой, и лишний
 * вопрос здесь только мешает.
 */
export function ArchiveButton({
  siteId,
  archived,
  name,
}: {
  siteId: string
  archived: boolean
  name: string
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggle() {
    setError(null)
    startTransition(async () => {
      const result = await archiveSiteAction({ siteId, archived: !archived })
      if (!result.ok) setError(result.error)
    })
  }

  if (error) {
    return (
      <span role="alert" className="text-caption font-semibold text-err-strong">
        {error}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={archived ? `Вернуть точку «${name}»` : `Убрать точку «${name}»`}
      className="inline-flex min-h-11 items-center rounded-control border border-line-strong px-3 text-table font-semibold text-ink-2 hover:bg-surface-2 disabled:opacity-50"
    >
      {archived ? 'Вернуть' : 'Убрать'}
    </button>
  )
}

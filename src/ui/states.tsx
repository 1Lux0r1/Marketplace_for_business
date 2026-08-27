import type { ReactNode } from 'react'

/**
 * Четыре состояния экрана (§7.4). Экран не считается готовым, пока не описаны все.
 *
 * Тексты — без извинений, без «Произошла ошибка», без кодов без объяснения:
 * что случилось и что сделать.
 */

/** Пустое: что здесь появится, зачем, и кнопка чтобы это создать. */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3.5 rounded-card border border-line bg-surface px-8 py-12 text-center">
      {icon && <span className="text-ink-3">{icon}</span>}
      <div>
        <p className="text-lead font-bold text-ink">{title}</p>
        <p className="mx-auto mt-2 max-w-[46ch] text-table text-ink-2">{description}</p>
      </div>
      {action}
    </div>
  )
}

/** Загрузка: скелет структуры, а не крутящийся спиннер по центру. */
export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div
      className="flex flex-col rounded-card border border-line bg-surface"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Загружаем список</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-t border-line px-[18px] py-3.5 first:border-t-0">
          <span className="flex-1">
            <span className="block h-3 w-3/5 rounded bg-skeleton" />
            <span className="mt-2 block h-2.5 w-1/3 rounded bg-skeleton" />
          </span>
          <span className="h-3 w-[74px] rounded bg-skeleton" />
          <span className="h-6 w-[92px] rounded-control bg-skeleton" />
        </div>
      ))}
    </div>
  )
}

/** Ошибка: что произошло, чего это НЕ затронуло, что делать, кнопка повтора. */
export function ErrorState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3.5 rounded-card border border-line bg-surface px-8 py-12 text-center"
    >
      <p className="text-lead font-bold text-ink">{title}</p>
      <p className="mx-auto max-w-[46ch] text-table text-ink-2">{description}</p>
      {action}
    </div>
  )
}

/** Успех: подтверждение конкретного действия, а не «Успешно сохранено». */
export function SuccessNote({ title, description }: { title: string; description: ReactNode }) {
  return (
    <div className="flex gap-3.5 rounded-card border border-ok bg-ok-tint p-4">
      <div>
        <p className="text-body font-bold text-ink">{title}</p>
        <p className="mt-1.5 max-w-[52ch] text-table text-ink-2">{description}</p>
      </div>
    </div>
  )
}

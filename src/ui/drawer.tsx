'use client'

import type { ReactNode } from 'react'
import { cx } from './cx'
import { useDialogBehavior } from './use-dialog'

/**
 * Шторка, выезжающая справа. Ведёт себя как модальное окно (§7.6):
 * фокус внутри, `Esc` закрывает, при закрытии фокус возвращается туда,
 * откуда её открыли. Само это поведение живёт в `use-dialog.ts` — оно общее
 * с окном подтверждения, и двух копий у него быть не должно.
 *
 * На узком экране занимает всю ширину: сбоку на телефоне ей места нет (§7.5).
 * Движение — 200 мс и только чтобы объяснить, откуда взялась (§7.7);
 * `prefers-reduced-motion` гасит его в `globals.css`.
 */
type Props = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function Drawer({ open, onClose, title, children }: Props) {
  const { panel, close } = useDialogBehavior(open, onClose)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Подложка гасит страницу и закрывает по нажатию мимо шторки.
          Для клавиатуры есть Esc и кнопка «Закрыть», поэтому это не роль button */}
      <div
        className="absolute inset-0 bg-ink/30 motion-safe:animate-[fade_150ms_ease-out]"
        onClick={close}
        aria-hidden="true"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'relative flex h-full w-full max-w-[440px] flex-col overflow-y-auto bg-surface',
          'shadow-drawer motion-safe:animate-[slide-in_200ms_ease-out]',
        )}
      >
        <div className="flex flex-none items-center justify-between gap-4 border-b border-line px-6 py-5">
          <h2 className="text-lead font-extrabold text-ink">{title}</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Закрыть"
            className="-mr-2 flex size-11 flex-none items-center justify-center rounded-control text-ink-2 hover:bg-surface-2"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path
                d="M4 4l10 10M14 4L4 14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-5 px-6 py-6">{children}</div>
      </div>
    </div>
  )
}

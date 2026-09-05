'use client'

import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { cx } from './cx'

/**
 * Шторка, выезжающая справа. Ведёт себя как модальное окно (§7.6):
 * фокус внутри, `Esc` закрывает, при закрытии фокус возвращается туда,
 * откуда её открыли.
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

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Drawer({ open, onClose, title, children }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  // Куда вернуть фокус: запоминаем до того, как заберём его в шторку
  useEffect(() => {
    if (open) openerRef.current = document.activeElement as HTMLElement | null
  }, [open])

  const close = useCallback(() => {
    onClose()
    openerRef.current?.focus()
  }, [onClose])

  useEffect(() => {
    if (!open) return

    const node = panel.current
    node?.querySelector<HTMLElement>(FOCUSABLE)?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key !== 'Tab' || !node) return

      // Обход по кругу внутри шторки: иначе Tab уводит на страницу под ней,
      // и человек с клавиатуры не понимает, где он
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null,
      )
      const first = items[0]
      const last = items.at(-1)
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    // Страница под шторкой не должна прокручиваться вместе с ней
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, close])

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

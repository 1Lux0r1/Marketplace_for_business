'use client'

import { useCallback, useEffect, useRef, type RefObject } from 'react'

/**
 * Поведение модального окна: фокус внутри, `Esc` закрывает, при закрытии
 * фокус возвращается туда, откуда открыли, страница под окном не прокручивается.
 *
 * Вынесено из шторки, чтобы окно подтверждения не заводило вторую копию.
 * Две копии ловушки фокуса — это ровно то место, где доступность разъезжается:
 * одну поправят, вторую забудут, и половина окон перестанет отпускать фокус.
 *
 * Требования §7.6 к модальным окнам выполняются здесь один раз.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useDialogBehavior(
  open: boolean,
  onClose: () => void,
): { panel: RefObject<HTMLDivElement | null>; close: () => void } {
  const panel = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLElement | null>(null)

  // Куда вернуть фокус: запоминаем до того, как заберём его в окно
  useEffect(() => {
    if (open) opener.current = document.activeElement as HTMLElement | null
  }, [open])

  const close = useCallback(() => {
    onClose()
    opener.current?.focus()
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

      // Обход по кругу внутри окна: иначе Tab уводит на страницу под ним,
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
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, close])

  return { panel, close }
}

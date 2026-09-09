'use client'

import type { ReactNode } from 'react'
import { Button } from './button'
import { useDialogBehavior } from './use-dialog'

/**
 * Окно подтверждения: снять карточку с публикации, отклонить регистрацию,
 * отозвать доступ.
 *
 * Не шторка. Шторка — это форма сбоку, её заполняют; окно — это развилка,
 * на ней отвечают «да» или «нет» и возвращаются туда, где были. Разное
 * назначение должно выглядеть по-разному, иначе человек перестаёт замечать
 * разницу и подтверждает не глядя.
 *
 * Поведение (фокус, `Esc`, возврат фокуса) — общее со шторкой, `use-dialog.ts`.
 *
 * `description` обязателен и это не формальность: §7.4 требует говорить,
 * что произойдёт, а не «Вы уверены?». Человек должен узнать про последствие
 * до нажатия, а не после.
 */
type Props = {
  open: boolean
  onClose: () => void
  title: string
  /** Что именно произойдёт и что из этого нельзя отменить. */
  description: ReactNode
  /** Надпись на главной кнопке — глагол действия, а не «ОК». */
  confirmLabel: string
  onConfirm: () => void
  /** Действие необратимое или разрушительное: кнопка становится опасной. */
  danger?: boolean
  cancelLabel?: string
  busy?: boolean
}

export function Modal({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
  danger = false,
  cancelLabel = 'Отмена',
  busy = false,
}: Props) {
  const { panel, close } = useDialogBehavior(open, onClose)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-ink/30 motion-safe:animate-[fade_150ms_ease-out]"
        onClick={close}
        aria-hidden="true"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative flex w-full max-w-[460px] flex-col gap-4 rounded-card bg-surface p-6 shadow-raised motion-safe:animate-[fade_150ms_ease-out]"
      >
        <div>
          <h2 id="modal-title" className="text-lead font-extrabold text-ink">
            {title}
          </h2>
          <p className="mt-2 text-body text-ink-2">{description}</p>
        </div>

        {/* Главное действие правее и сильнее: на развилке взгляд идёт направо.
            Отмена рядом, но тише — она не должна выглядеть как выбор по умолчанию,
            и не должна прятаться */}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={close} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'accent'} onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

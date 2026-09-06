'use client'

import type { ReactNode, TextareaHTMLAttributes } from 'react'
import { FieldFrame, controlClasses, fieldAria, useFieldIds } from './field-frame'

/**
 * Многострочное поле: описание услуги, причина отклонения, что важно знать
 * подрядчику. Растёт вниз, а не вширь — страница не должна ехать вбок (§7.5).
 *
 * Высота задаётся строками, а не пикселями: так поле остаётся правильным
 * при другом размере шрифта.
 */
type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  hint?: ReactNode
  error?: string
}

export function Textarea({ label, hint, error, className, id, rows = 4, ...rest }: Props) {
  const ids = useFieldIds(id)

  return (
    <FieldFrame
      label={label}
      htmlFor={ids.inputId}
      hint={hint}
      hintId={ids.hintId}
      error={error}
      errorId={ids.errorId}
    >
      <textarea
        id={ids.inputId}
        rows={rows}
        {...fieldAria(ids, hint, error)}
        className={controlClasses(error, 'resize-y py-2.5 leading-relaxed ' + (className ?? ''))}
        {...rest}
      />
    </FieldFrame>
  )
}

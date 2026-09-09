'use client'

import type { InputHTMLAttributes, ReactNode } from 'react'
import { FieldFrame, controlClasses, fieldAria, useFieldIds } from './field-frame'

/**
 * Однострочное поле ввода. Подпись, пояснение и ошибка — из общей обвязки,
 * чтобы четыре вида полей не разъехались между собой (§7.6).
 */
type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: ReactNode
  error?: string
}

export function Field({ label, hint, error, className, id, ...rest }: Props) {
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
      <input
        id={ids.inputId}
        {...fieldAria(ids, hint, error)}
        className={controlClasses(error, 'h-11 ' + (className ?? ''))}
        {...rest}
      />
    </FieldFrame>
  )
}

'use client'

import type { InputHTMLAttributes, ReactNode } from 'react'
import { useId } from 'react'
import { cx } from './cx'

/**
 * Поле формы. `label` связан с полем, ошибка стоит рядом с полем,
 * а не только сверху формы (§7.6).
 *
 * Проверка здесь — удобство, а не защита: любой вход всё равно проходит
 * через Zod-схему на сервере (§6).
 */
type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: ReactNode
  error?: string
}

export function Field({ label, hint, error, className, id, ...rest }: Props) {
  const generated = useId()
  const inputId = id ?? generated
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-table font-semibold text-ink">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={cx(error ? errorId : null, hint ? hintId : null) || undefined}
        className={cx(
          'h-11 w-full rounded-control border bg-surface px-3.5 text-body text-ink',
          'placeholder:text-ink-3',
          error ? 'border-err' : 'border-line-strong',
          className,
        )}
        {...rest}
      />
      {hint && !error && (
        <p id={hintId} className="text-caption text-ink-3">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-caption font-semibold text-err-strong">
          {error}
        </p>
      )}
    </div>
  )
}

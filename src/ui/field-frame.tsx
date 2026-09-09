'use client'

import type { ReactNode } from 'react'
import { useId } from 'react'
import { cx } from './cx'

/**
 * Общая обвязка поля формы: подпись, само поле, пояснение и ошибка.
 *
 * Существует, чтобы требования §7.6 выполнялись один раз, а не повторялись
 * в каждом поле: `label` связан с полем, ошибка стоит рядом с полем, а не
 * только сверху формы, и она же прочитывается вслух через `aria-describedby`.
 * Четыре копии этой разметки разъехались бы к третьему спринту.
 *
 * Проверка на стороне человека — удобство, а не защита: любой вход всё равно
 * проходит через Zod-схему на сервере (§6).
 */
export function useFieldIds(id?: string): {
  inputId: string
  hintId: string
  errorId: string
} {
  const generated = useId()
  const inputId = id ?? generated
  return { inputId, hintId: `${inputId}-hint`, errorId: `${inputId}-error` }
}

/** Признаки поля для чтения с экрана. Собираются здесь, чтобы не забыть ни один. */
export function fieldAria(
  ids: { hintId: string; errorId: string },
  hint: ReactNode,
  error?: string,
): { 'aria-invalid': true | undefined; 'aria-describedby': string | undefined } {
  return {
    'aria-invalid': error ? true : undefined,
    'aria-describedby': cx(error ? ids.errorId : null, hint ? ids.hintId : null) || undefined,
  }
}

export function FieldFrame({
  label,
  htmlFor,
  hint,
  hintId,
  error,
  errorId,
  children,
}: {
  label: string
  htmlFor: string
  hint?: ReactNode
  hintId: string
  error?: string
  errorId: string
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-table font-semibold text-ink">
        {label}
      </label>
      {children}
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

/** Общий вид всех полей ввода: высота, рамка, радиус. Задаётся в одном месте. */
export function controlClasses(error?: string, extra?: string): string {
  return cx(
    'w-full rounded-control border bg-surface px-3.5 text-body text-ink placeholder:text-ink-3',
    error ? 'border-err' : 'border-line-strong',
    extra,
  )
}

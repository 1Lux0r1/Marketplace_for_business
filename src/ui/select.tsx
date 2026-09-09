'use client'

import type { ReactNode, SelectHTMLAttributes } from 'react'
import { FieldFrame, controlClasses, fieldAria, useFieldIds } from './field-frame'

/**
 * Выпадающий список: категория, зона, статус, объект клиента.
 *
 * Внутри — обычный `select` браузера, а не своя раскрывающаяся панель.
 * Причина не в экономии: на телефоне браузер показывает свой родной выбор,
 * который удобнее любого нарисованного, и с клавиатуры он работает сам.
 * Своя панель — это отдельная библиотека, которую сопровождать семь месяцев,
 * и почти гарантированно потерянный фокус (§3, §7.5, §7.6).
 *
 * Коды зон и категорий руками не вводятся: опечатка молча обнулит подбор
 * (`docs/05-sprint-02.md`). Поэтому список — не поле со строкой.
 */
export type Option = { value: string; label: string; disabled?: boolean }

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  label: string
  options: Option[]
  /** Первая строка, когда значение не выбрано. Без неё браузер выберет первое сам. */
  placeholder?: string
  hint?: ReactNode
  error?: string
}

export function Select({
  label,
  options,
  placeholder,
  hint,
  error,
  className,
  id,
  ...rest
}: Props) {
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
      <div className="relative">
        <select
          id={ids.inputId}
          {...fieldAria(ids, hint, error)}
          className={controlClasses(error, 'h-11 appearance-none pr-10 ' + (className ?? ''))}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        {/* Уголок рисуем сами: родной у каждого браузера свой и не совпадает
            с остальными полями. Клики не перехватывает */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-ink-3"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9.5l6 6 6-6" />
          </svg>
        </span>
      </div>
    </FieldFrame>
  )
}

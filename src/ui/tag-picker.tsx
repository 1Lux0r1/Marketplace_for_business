'use client'

import { useId } from 'react'
import { cx } from './cx'

/**
 * Множественный выбор: категории и зоны подрядчика, зоны карточки услуги.
 *
 * Под каждым чипом — настоящая галочка. Она не видна, но существует: с ней
 * работает клавиатура, чтение с экрана и отправка формы без единой строки
 * своего кода. Нарисованный «чип-переключатель» на `div` не умеет ничего
 * из этого, и это первое, что ломается при проверке доступности (§7.6).
 *
 * Значения приходят снаружи, руками их никто не вводит: код зоны с опечаткой
 * молча обнулит подбор (`docs/05-sprint-02.md`).
 */
export type TagOption = { value: string; label: string }

export function TagPicker({
  legend,
  name,
  options,
  selected,
  onChange,
  hint,
  error,
}: {
  legend: string
  name: string
  options: TagOption[]
  selected: string[]
  onChange: (next: string[]) => void
  hint?: string
  error?: string
}) {
  const groupId = useId()
  const hintId = `${groupId}-hint`
  const errorId = `${groupId}-error`

  function toggle(value: string): void {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  return (
    <fieldset
      className="flex min-w-0 flex-col gap-2.5"
      aria-describedby={cx(error ? errorId : null, hint ? hintId : null) || undefined}
    >
      <legend className="text-table font-semibold text-ink">{legend}</legend>

      <div className="flex flex-wrap gap-2.5">
        {options.map((option) => {
          const isSelected = selected.includes(option.value)
          return (
            <label
              key={option.value}
              className={cx(
                'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-pill border px-4 text-table',
                'transition-colors duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-2',
                'has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-strong',
                isSelected
                  ? 'border-accent bg-accent-tint font-bold text-accent-strong'
                  : 'border-line-strong bg-surface font-medium text-ink-2 hover:bg-surface-2 hover:text-ink',
              )}
            >
              <input
                type="checkbox"
                name={name}
                value={option.value}
                checked={isSelected}
                onChange={() => toggle(option.value)}
                className="sr-only"
              />
              {/* Галочка рисуется значком, а не только цветом: цвет не единственный
                  носитель смысла (§7.2) */}
              <span aria-hidden className={cx('flex size-4 items-center justify-center', !isSelected && 'opacity-0')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7" />
                </svg>
              </span>
              {option.label}
            </label>
          )
        })}
      </div>

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
    </fieldset>
  )
}

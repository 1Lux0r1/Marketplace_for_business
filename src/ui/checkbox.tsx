'use client'

import type { InputHTMLAttributes } from 'react'
import { useId } from 'react'
import { cx } from './cx'

/**
 * Галочка с подписью. Целевая область — вся строка, не сам квадратик:
 * 16 пикселей пальцем не попасть (§7.5).
 */
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string }

export function Checkbox({ label, className, id, ...rest }: Props) {
  const generated = useId()
  const inputId = id ?? generated

  return (
    <label
      htmlFor={inputId}
      className={cx('flex min-h-11 cursor-pointer items-center gap-3 text-body text-ink', className)}
    >
      <input
        id={inputId}
        type="checkbox"
        className="size-5 flex-none accent-[var(--accent)]"
        {...rest}
      />
      <span>{label}</span>
    </label>
  )
}

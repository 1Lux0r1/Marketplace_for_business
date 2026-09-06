'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { kopecksToInput, parseRublesToKopecks } from '@/shared/money'
import { FieldFrame, controlClasses, fieldAria, useFieldIds } from './field-frame'

/**
 * Поле цены. Человек печатает рубли, наружу уходят копейки (§6).
 *
 * Своё состояние у поля есть намеренно: пока человек печатает «5 4», это
 * ещё не сумма, и нельзя ни выбрасывать введённое, ни отдавать наружу мусор.
 * Поэтому строка живёт в поле, а `onChange` зовётся только когда из неё
 * получается сумма — или когда поле опустело.
 *
 * Разбор строки — в `@/shared/money`, там же где комиссия, и покрыт тестами:
 * лишний ноль в цене карточки уходит в каталог и в счёт (§8).
 */
type Props = {
  label: string
  /** Текущая цена в копейках. `null` — не введена. */
  valueKopecks: bigint | null
  onChange: (kopecks: bigint | null) => void
  hint?: ReactNode
  error?: string
  id?: string
  name?: string
  disabled?: boolean
  required?: boolean
}

export function MoneyField({
  label,
  valueKopecks,
  onChange,
  hint,
  error,
  id,
  name,
  disabled,
  required,
}: Props) {
  const ids = useFieldIds(id)
  const [text, setText] = useState(() => kopecksToInput(valueKopecks))
  const [unreadable, setUnreadable] = useState(false)

  const message = error ?? (unreadable ? 'Впишите сумму цифрами, например 5 400 или 5 400,50' : undefined)

  return (
    <FieldFrame
      label={label}
      htmlFor={ids.inputId}
      hint={hint}
      hintId={ids.hintId}
      error={message}
      errorId={ids.errorId}
    >
      <div className="relative">
        <input
          id={ids.inputId}
          name={name}
          disabled={disabled}
          required={required}
          // Не `type=number`: он прячет введённое при кривом вводе и по-разному
          // ведёт себя с запятой в разных браузерах. На телефоне нужную
          // клавиатуру открывает `inputMode`
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          placeholder="0"
          {...fieldAria(ids, hint, message)}
          className={controlClasses(message, 'num h-11 pr-9 text-right')}
          onChange={(event) => {
            const next = event.target.value
            setText(next)
            const parsed = parseRublesToKopecks(next)
            setUnreadable(parsed === undefined)
            if (parsed !== undefined) onChange(parsed)
          }}
          onBlur={() => {
            // Приводим к единому виду только когда человек закончил печатать:
            // иначе поле переписывает себя под руками
            const parsed = parseRublesToKopecks(text)
            if (parsed !== undefined) setText(kopecksToInput(parsed))
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-body text-ink-3"
        >
          ₽
        </span>
      </div>
    </FieldFrame>
  )
}

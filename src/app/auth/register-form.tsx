'use client'

import { useState, useTransition } from 'react'
import { Button, Field, cx } from '@/ui'
import { registerAction, verifyEmailAction } from '@/server/auth-actions'

/**
 * Регистрация в два шага в одной шторке: сначала форма, потом код из письма.
 *
 * Форма собственности стоит первой, потому что от неё зависит остальное:
 * физлицу ИНН не нужен, а юрлицу нужен (`docs/12-auth-ux.md`).
 *
 * Справочник компаний по ИНН пока не подключён (Q20), поэтому название
 * вводится руками. Когда справочник появится, поле начнёт заполняться само —
 * форма от этого не изменится.
 */
const forms = [
  { value: 'individual', label: 'Физлицо' },
  { value: 'sole_trader', label: 'ИП' },
  { value: 'company', label: 'Юрлицо' },
] as const

type LegalForm = (typeof forms)[number]['value']

export function RegisterForm({ onDone }: { onDone: () => void }) {
  const [legalForm, setLegalForm] = useState<LegalForm>('company')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const needsInn = legalForm !== 'individual'

  function submit(form: FormData) {
    setError(null)
    const email = String(form.get('email') ?? '')
    startTransition(async () => {
      const result = await registerAction({
        legalForm,
        companyName: String(form.get('companyName') ?? ''),
        inn: String(form.get('inn') ?? ''),
        fullName: String(form.get('fullName') ?? ''),
        position: String(form.get('position') ?? ''),
        email,
        phone: String(form.get('phone') ?? ''),
        password: String(form.get('password') ?? ''),
      })
      if (result.ok) setSentTo(email)
      else setError(result.error)
    })
  }

  function confirm(form: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await verifyEmailAction({
        email: sentTo,
        code: String(form.get('code') ?? ''),
      })
      if (result.ok) onDone()
      else setError(result.error)
    })
  }

  if (sentTo) {
    return (
      <form action={confirm} className="flex flex-col gap-5">
        <p className="text-body text-ink-2">
          Мы отправили код на <span className="font-semibold text-ink">{sentTo}</span>. Введите его —
          и учётная запись включится.
        </p>
        <Field
          label="Код из письма"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          className="num text-lead tracking-[0.3em]"
          required
        />
        {error && (
          <p role="alert" className="text-body font-semibold text-err-strong">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" block disabled={pending}>
          {pending ? 'Проверяем…' : 'Подтвердить'}
        </Button>
        <p className="text-caption text-ink-3">
          Письмо идёт до минуты. Если не пришло — проверьте папку «Спам».
        </p>
      </form>
    )
  }

  return (
    <form action={submit} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-table font-semibold text-ink">Кто вы</legend>
        <div className="flex gap-2">
          {forms.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setLegalForm(value)}
              aria-pressed={legalForm === value}
              className={cx(
                'h-11 flex-1 rounded-control border text-body font-semibold transition-colors duration-150',
                legalForm === value
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-line-strong bg-surface text-ink-2 hover:bg-surface-2',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {needsInn && (
        <>
          <Field
            label="ИНН"
            name="inn"
            inputMode="numeric"
            className="num"
            placeholder={legalForm === 'company' ? '7701234567' : '770123456789'}
            hint="По нему подтянутся реквизиты — пока вводим название руками"
            required
          />
          <Field
            label={legalForm === 'company' ? 'Название организации' : 'Название дела'}
            name="companyName"
            placeholder="Кофейня «Пример»"
            required
          />
        </>
      )}

      <Field label="Фамилия и имя" name="fullName" autoComplete="name" required />

      {needsInn && (
        <Field
          label="Ваша роль в организации"
          name="position"
          placeholder="Директор"
          hint="Если вы директор, сверим с реестром — это займёт минуту"
        />
      )}

      <Field
        label="Почта"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="anna@example.ru"
        hint="На неё придёт код подтверждения"
        required
      />
      <Field
        label="Телефон"
        name="phone"
        type="tel"
        autoComplete="tel"
        placeholder="+7 916 123-45-67"
        required
      />
      <Field
        label="Пароль"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="От 10 символов. Три несвязанных слова надёжнее и запоминаются легче"
        required
      />

      {error && (
        <p role="alert" className="text-body font-semibold text-err-strong">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? 'Отправляем…' : 'Зарегистрироваться'}
      </Button>
      <p className="text-caption text-ink-3">
        Регистрация даёт роль заказчика. Выполнять работы можно после проверки — включим
        отдельно, когда понадобится.
      </p>
    </form>
  )
}

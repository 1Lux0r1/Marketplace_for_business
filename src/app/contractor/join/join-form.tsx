'use client'

import { useState, useTransition } from 'react'
import { Button, Field, SuccessNote, cx } from '@/ui'
import { joinAsContractorAction } from '@/server/catalog-actions'
import { verifyEmailAction } from '@/server/auth-actions'

/**
 * «Стать подрядчиком»: подрядчик заводит себя сам (решение Q10).
 *
 * Форма не ждёт справочник ИНН и не может из-за него отказать. Человек
 * отправляет заявку и сразу видит, что дальше: мы проверим ИНН и включим
 * его в каталог. Проверка идёт отдельно.
 *
 * Два шага, как в шторке регистрации: форма, потом код из письма. Второй шаг
 * обязателен — без него мы отправляем код и не даём, куда его ввести, а учётная
 * запись остаётся невключённой. Проверка ИНН к этому отношения не имеет:
 * почту человек подтверждает сам и сразу, ИНН проверяем мы и потом.
 */

const FORMS = [
  { value: 'sole_trader', label: 'ИП' },
  { value: 'company', label: 'Юрлицо' },
  { value: 'individual', label: 'Самозанятый' },
] as const

type LegalForm = (typeof FORMS)[number]['value']

export function JoinForm() {
  const [legalForm, setLegalForm] = useState<LegalForm>('sole_trader')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(form: FormData) {
    setError(null)
    const email = String(form.get('email') ?? '')
    startTransition(async () => {
      const result = await joinAsContractorAction({
        inn: String(form.get('inn') ?? ''),
        legalForm,
        companyName: String(form.get('companyName') ?? ''),
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
      if (result.ok) setDone(true)
      else setError(result.error)
    })
  }

  if (done) {
    return (
      <SuccessNote
        title="Готово, вы в системе"
        description={
          <>
            Почта подтверждена — входить можно уже сейчас. Осталась проверка ИНН:
            мы сверим его и включим вас в каталог. Если справочник не ответит,
            заявку посмотрит наш сотрудник — это не отказ, просто дольше.
          </>
        }
      />
    )
  }

  if (sentTo) {
    return (
      <form action={confirm} className="flex max-w-[560px] flex-col gap-5">
        <p className="text-body text-ink-2">
          Заявка принята. Мы отправили код на{' '}
          <span className="font-semibold text-ink">{sentTo}</span> — введите его,
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
    <form action={submit} className="flex max-w-[560px] flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-table font-semibold text-ink">Как вы работаете</legend>
        <div className="flex flex-wrap gap-2">
          {FORMS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setLegalForm(option.value)}
              aria-pressed={legalForm === option.value}
              className={cx(
                'h-11 rounded-control border px-4 text-body font-semibold transition-colors duration-150',
                legalForm === option.value
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-line-strong bg-surface text-ink-2 hover:bg-surface-2',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <Field
        label="ИНН"
        name="inn"
        inputMode="numeric"
        className="num"
        placeholder={legalForm === 'company' ? '7701234560' : '770123456703'}
        hint="Десять цифр у юрлица, двенадцать у ИП и самозанятого"
        required
      />
      <Field
        label={legalForm === 'company' ? 'Название организации' : 'Название дела'}
        name="companyName"
        placeholder="СанПро"
        hint="Его увидят заказчики в каталоге"
        required
      />
      <Field label="Фамилия и имя" name="fullName" autoComplete="name" required />
      <Field
        label="Ваша роль"
        name="position"
        placeholder="Директор"
        hint="Если вы директор, сверим с реестром"
      />
      <Field
        label="Почта"
        name="email"
        type="email"
        autoComplete="email"
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
        {pending ? 'Отправляем…' : 'Стать подрядчиком'}
      </Button>
    </form>
  )
}

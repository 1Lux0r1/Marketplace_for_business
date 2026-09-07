'use client'

import { useState, useTransition } from 'react'
import { Button, Field, cx } from '@/ui'
import { registerAction, resendCodeAction, verifyEmailAction } from '@/server/auth-actions'

/**
 * Регистрация в два шага в одной шторке: сначала форма, потом код из письма.
 *
 * Форма собственности стоит первой, потому что от неё зависит остальное:
 * физлицу ИНН не нужен, а юрлицу нужен (`docs/12-auth-ux.md`).
 *
 * Третий шаг — «прислать код заново». Он нужен не для красоты: письмо может
 * не дойти, код живёт 15 минут, а шторку легко закрыть. Без этого шага
 * учётная запись остаётся навсегда неподтверждённой — войти в неё нельзя,
 * потому что почта не подтверждена, и завести заново нельзя, потому что
 * адрес занят.
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
type Step = 'form' | 'resend' | 'code'
type Problem = { text: string; field?: string | undefined }

export function RegisterForm({ onDone }: { onDone: () => void }) {
  const [legalForm, setLegalForm] = useState<LegalForm>('company')
  const [step, setStep] = useState<Step>('form')
  const [email, setEmail] = useState('')
  const [problem, setProblem] = useState<Problem | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const needsInn = legalForm !== 'individual'
  /** Ошибка показывается у своего поля, а не только общей строкой внизу (§7.6). */
  const at = (field: string) => (problem?.field === field ? problem.text : undefined)
  const general = problem && !problem.field ? problem.text : null

  function submit(form: FormData) {
    setProblem(null)
    setNotice(null)
    const entered = String(form.get('email') ?? '')
    startTransition(async () => {
      const result = await registerAction({
        legalForm,
        // Физлицу этих полей на экране нет — и слать пустые строки нельзя:
        // сервер отвечал бы ошибкой про поле, которого человек не видит
        ...(needsInn
          ? {
              companyName: String(form.get('companyName') ?? ''),
              inn: String(form.get('inn') ?? ''),
              position: String(form.get('position') ?? ''),
            }
          : {}),
        fullName: String(form.get('fullName') ?? ''),
        email: entered,
        phone: String(form.get('phone') ?? ''),
        password: String(form.get('password') ?? ''),
      })
      if (result.ok) {
        setEmail(entered)
        setStep('code')
        setNotice(result.message ?? null)
      } else {
        setProblem({ text: result.error, field: result.field })
      }
    })
  }

  function askAgain(form: FormData) {
    setProblem(null)
    setNotice(null)
    const entered = String(form.get('email') ?? '')
    startTransition(async () => {
      const result = await resendCodeAction({ email: entered })
      if (result.ok) {
        setEmail(entered)
        setStep('code')
        setNotice(result.message ?? null)
      } else {
        setProblem({ text: result.error, field: result.field })
      }
    })
  }

  function resend() {
    setProblem(null)
    setNotice(null)
    startTransition(async () => {
      const result = await resendCodeAction({ email })
      if (result.ok) setNotice(result.message ?? 'Код отправлен')
      else setProblem({ text: result.error, field: result.field })
    })
  }

  function confirm(form: FormData) {
    setProblem(null)
    setNotice(null)
    startTransition(async () => {
      const result = await verifyEmailAction({ email, code: String(form.get('code') ?? '') })
      if (result.ok) onDone()
      else setProblem({ text: result.error, field: result.field })
    })
  }

  if (step === 'code') {
    return (
      <form action={confirm} className="flex flex-col gap-5">
        <p className="text-body text-ink-2">
          Мы отправили код на <span className="font-semibold text-ink">{email}</span>. Введите его —
          и учётная запись включится.
        </p>
        <Field
          label="Код из письма"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          className="num text-lead tracking-[0.3em]"
          error={at('code')}
          required
        />
        {notice && (
          <p role="status" className="text-body text-ok-strong">
            {notice}
          </p>
        )}
        <Alert text={general} />
        <Button type="submit" size="lg" block disabled={pending}>
          {pending ? 'Проверяем…' : 'Подтвердить'}
        </Button>
        <div className="flex flex-col gap-1">
          <p className="text-caption text-ink-3">
            Письмо идёт до минуты. Если не пришло — проверьте папку «Спам».
          </p>
          <button
            type="button"
            onClick={resend}
            disabled={pending}
            className="inline-flex min-h-11 items-center self-start text-body font-semibold text-accent-strong underline underline-offset-2"
          >
            Отправить код ещё раз
          </button>
        </div>
      </form>
    )
  }

  if (step === 'resend') {
    return (
      <form action={askAgain} className="flex flex-col gap-5">
        <p className="text-body text-ink-2">
          Если вы уже регистрировались, но не ввели код, — укажите почту, и мы пришлём новый.
        </p>
        <Field
          label="Почта"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={email}
          placeholder="anna@example.ru"
          error={at('email')}
          required
        />
        <Alert text={general} />
        <Button type="submit" size="lg" block disabled={pending}>
          {pending ? 'Отправляем…' : 'Прислать код'}
        </Button>
        <button
          type="button"
          onClick={() => {
            setProblem(null)
            setStep('form')
          }}
          className="inline-flex min-h-11 items-center self-start text-body font-semibold text-accent-strong underline underline-offset-2"
        >
          Назад к регистрации
        </button>
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
            placeholder={legalForm === 'company' ? '7701234560' : '770123456703'}
            hint={
              legalForm === 'company'
                ? '10 цифр. По нему подтянутся реквизиты — пока вводим название руками'
                : '12 цифр. По нему подтянутся реквизиты — пока вводим название руками'
            }
            error={at('inn')}
            required
          />
          <Field
            label={legalForm === 'company' ? 'Название организации' : 'Название дела'}
            name="companyName"
            placeholder="Кофейня «Пример»"
            error={at('companyName')}
            required
          />
        </>
      )}

      <Field
        label="Фамилия и имя"
        name="fullName"
        autoComplete="name"
        error={at('fullName')}
        required
      />

      {needsInn && (
        <Field
          label="Ваша роль в организации"
          name="position"
          placeholder="Директор"
          hint="Если вы директор, сверим с реестром — это займёт минуту"
          error={at('position')}
        />
      )}

      <Field
        label="Почта"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="anna@example.ru"
        hint="На неё придёт код подтверждения"
        error={at('email')}
        required
      />
      <Field
        label="Телефон"
        name="phone"
        type="tel"
        autoComplete="tel"
        placeholder="+7 916 123-45-67"
        error={at('phone')}
        required
      />
      <Field
        label="Пароль"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="От 10 символов. Три несвязанных слова надёжнее и запоминаются легче"
        error={at('password')}
        required
      />

      <Alert text={general} />

      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? 'Отправляем…' : 'Зарегистрироваться'}
      </Button>
      <p className="text-caption text-ink-3">
        Регистрация даёт роль заказчика. Выполнять работы можно после проверки — включим
        отдельно, когда понадобится.
      </p>
      <button
        type="button"
        onClick={() => {
          setProblem(null)
          setStep('resend')
        }}
        className="inline-flex min-h-11 items-center self-start text-body font-semibold text-accent-strong underline underline-offset-2"
      >
        Регистрировались, но не ввели код?
      </button>
    </form>
  )
}

/** Общая ошибка — та, что не привязана к полю. Привязанная стоит у поля. */
function Alert({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <p role="alert" className="text-body font-semibold text-err-strong">
      {text}
    </p>
  )
}

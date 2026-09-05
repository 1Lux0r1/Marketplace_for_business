'use client'

import { useState, useTransition } from 'react'
import { Button, Checkbox, Field } from '@/ui'
import { loginAction } from '@/server/auth-actions'

/**
 * Вход по паролю. Одно поле на почту и телефон — так в утверждённом
 * сценарии (`docs/12-auth-ux.md`).
 *
 * Ответ на незнакомый адрес не отличается от ответа на знакомый: иначе форма
 * входа отвечает на вопрос «кто у вас зарегистрирован».
 */
export function LoginForm({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(form: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await loginAction({
        login: String(form.get('login') ?? ''),
        password: String(form.get('password') ?? ''),
        remember: form.get('remember') === 'on',
      })
      if (result.ok) onDone()
      else setError(result.error)
    })
  }

  return (
    <form action={submit} className="flex flex-col gap-5">
      <Field
        label="Почта или телефон"
        name="login"
        autoComplete="username"
        placeholder="anna@example.ru"
        required
      />
      <Field
        label="Пароль"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <Checkbox
        name="remember"
        label="Запомнить меня на 30 дней"
      />

      {error && (
        <p role="alert" className="text-body font-semibold text-err-strong">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? 'Проверяем…' : 'Войти'}
      </Button>
    </form>
  )
}

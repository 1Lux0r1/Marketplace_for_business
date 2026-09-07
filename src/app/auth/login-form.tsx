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
  const [problem, setProblem] = useState<{ text: string; field?: string | undefined } | null>(null)
  const [pending, startTransition] = useTransition()

  /** Ошибка стоит у своего поля, а не только общей строкой внизу (§7.6). */
  const at = (field: string) => (problem?.field === field ? problem.text : undefined)
  const general = problem && !problem.field ? problem.text : null

  function submit(form: FormData) {
    setProblem(null)
    startTransition(async () => {
      const result = await loginAction({
        login: String(form.get('login') ?? ''),
        password: String(form.get('password') ?? ''),
        remember: form.get('remember') === 'on',
      })
      if (result.ok) onDone()
      else setProblem({ text: result.error, field: result.field })
    })
  }

  return (
    <form action={submit} className="flex flex-col gap-5">
      <Field
        label="Почта или телефон"
        name="login"
        autoComplete="username"
        placeholder="anna@example.ru"
        error={at('login')}
        required
      />
      <Field
        label="Пароль"
        name="password"
        type="password"
        autoComplete="current-password"
        error={at('password')}
        required
      />
      <Checkbox
        name="remember"
        label="Запомнить меня на 30 дней"
      />

      {general && (
        <p role="alert" className="text-body font-semibold text-err-strong">
          {general}
        </p>
      )}

      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? 'Проверяем…' : 'Войти'}
      </Button>
    </form>
  )
}

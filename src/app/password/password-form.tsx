'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Field, SuccessNote } from '@/ui'
import { setPasswordAction } from '@/server/auth-actions'

/**
 * Установка пароля по ссылке из приглашения.
 *
 * После сохранения человек уже внутри: переходом по ссылке он доказал, что
 * владеет почтой, и просить его после этого войти заново — лишний шаг там,
 * где он ничего не проверяет.
 */
export function PasswordForm({ token }: { token: string }) {
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function submit(form: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await setPasswordAction({
        token,
        password: String(form.get('password') ?? ''),
      })
      if (result.ok) {
        setDone(true)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  if (done) {
    return (
      <SuccessNote
        title="Готово, вы внутри"
        description="Пароль сохранён, и вы уже вошли. Загляните в «Компанию» — там точки вашей организации."
      />
    )
  }

  return (
    <form action={submit} className="flex max-w-[560px] flex-col gap-5">
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
        {pending ? 'Сохраняем…' : 'Сохранить и войти'}
      </Button>
    </form>
  )
}

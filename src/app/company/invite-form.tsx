'use client'

import { useState, useTransition } from 'react'
import { Button, Drawer, Field, cx } from '@/ui'
import { inviteAction } from '@/server/company-actions'

/**
 * Приглашение сотрудника.
 *
 * Права названы тем, что человек сможет делать, а не системными словами:
 * «owner» и «staff» владельцу кофейни ничего не говорят (§7.1).
 */
const ROLES = [
  {
    value: 'staff',
    label: 'Работа с заказами',
    hint: 'Заказывает услуги, общается с подрядчиком, принимает работу',
  },
  {
    value: 'owner',
    label: 'Полный доступ',
    hint: 'То же плюс реквизиты, точки и приглашение других',
  },
] as const

type RoleValue = (typeof ROLES)[number]['value']

export function InviteForm({ onClose }: { onClose: () => void }) {
  const [role, setRole] = useState<RoleValue>('staff')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(form: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await inviteAction({
        fullName: String(form.get('fullName') ?? ''),
        email: String(form.get('email') ?? ''),
        phone: String(form.get('phone') ?? ''),
        position: String(form.get('position') ?? ''),
        role,
      })
      if (result.ok) onClose()
      else setError(result.error)
    })
  }

  return (
    <Drawer open onClose={onClose} title="Пригласить сотрудника">
      <form action={submit} className="flex flex-col gap-5">
        <p className="text-body text-ink-2">
          Мы отправим человеку письмо со ссылкой. Он придумает пароль и сразу окажется
          внутри — регистрироваться заново ему не нужно.
        </p>

        <Field label="Фамилия и имя" name="fullName" autoComplete="name" required />
        <Field
          label="Почта"
          name="email"
          type="email"
          autoComplete="email"
          hint="На неё уйдёт приглашение"
          required
        />
        <Field label="Телефон" name="phone" type="tel" placeholder="+7 916 123-45-67" required />
        <Field label="Должность" name="position" placeholder="Управляющий" />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-table font-semibold text-ink">Что сможет делать</legend>
          <div className="flex flex-col gap-2">
            {ROLES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRole(option.value)}
                aria-pressed={role === option.value}
                className={cx(
                  'flex min-h-11 flex-col items-start gap-0.5 rounded-control border p-3 text-left transition-colors duration-150',
                  role === option.value
                    ? 'border-accent bg-accent-tint'
                    : 'border-line-strong hover:bg-surface-2',
                )}
              >
                <span className="text-body font-semibold text-ink">{option.label}</span>
                <span className="text-caption text-ink-3">{option.hint}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="text-body font-semibold text-err-strong">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" block disabled={pending}>
          {pending ? 'Отправляем…' : 'Отправить приглашение'}
        </Button>
      </form>
    </Drawer>
  )
}

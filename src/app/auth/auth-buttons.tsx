'use client'

import { useState } from 'react'
import { Button, Drawer } from '@/ui'
import { LoginForm } from './login-form'
import { RegisterForm } from './register-form'

/**
 * Две кнопки в правом верхнем углу и две шторки к ним.
 *
 * Главное действие для нового посетителя одно, поэтому «Регистрация» —
 * заливкой, «Войти» — контуром (§7.1 и `docs/12-auth-ux.md`). Обе в цветах
 * системы, но одинаково яркими быть не могут: тогда на экране два главных
 * действия, а это признак неправильно спроектированного экрана.
 */
type Panel = 'login' | 'register' | null

export function AuthButtons() {
  const [panel, setPanel] = useState<Panel>(null)

  return (
    <>
      <div className="flex flex-none items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setPanel('login')}>
          Войти
        </Button>
        <Button size="sm" onClick={() => setPanel('register')}>
          Регистрация
        </Button>
      </div>

      <Drawer open={panel === 'login'} onClose={() => setPanel(null)} title="Вход">
        <LoginForm onDone={() => setPanel(null)} />
        <Switch question="Ещё нет учётной записи?" label="Зарегистрироваться" onClick={() => setPanel('register')} />
      </Drawer>

      <Drawer open={panel === 'register'} onClose={() => setPanel(null)} title="Регистрация">
        <RegisterForm onDone={() => setPanel(null)} />
        <Switch question="Уже регистрировались?" label="Войти" onClick={() => setPanel('login')} />
      </Drawer>
    </>
  )
}

/**
 * Переход между шторками. Ссылка вынесена на свою строку и растянута
 * до 44 пикселей по высоте: в строку текста пальцем не попасть (§7.5).
 */
function Switch({
  question,
  label,
  onClick,
}: {
  question: string
  label: string
  onClick: () => void
}) {
  return (
    <div className="mt-auto flex flex-wrap items-center gap-x-2 pt-4">
      <span className="text-body text-ink-2">{question}</span>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex min-h-11 items-center text-body font-semibold text-accent-strong underline underline-offset-2"
      >
        {label}
      </button>
    </div>
  )
}

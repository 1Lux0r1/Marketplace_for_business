'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Textarea } from '@/ui'
import type { DealRow } from '@/server/deal-queries'
import { moveDealAction } from '@/server/deal-actions'

/**
 * Что подрядчик может сделать с заказом сейчас.
 *
 * Отказаться от заказа — это отмена, и причина обязательна: её читает клиент,
 * который уже заплатил и ждёт. «Отменено» без слов здесь особенно плохо.
 */
export function WorkActions({ row }: { row: DealRow }) {
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function move(to: string, reason?: string) {
    setError(null)
    startTransition(async () => {
      const result = await moveDealAction({ dealId: row.id, to, reason })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setAsking(false)
      // Без этого карточка останется со старым статусом до перезагрузки:
      // `revalidatePath` обновляет кэш на сервере, а не то, что уже на экране
      router.refresh()
    })
  }

  if (asking) {
    return (
      <form
        action={(form) => move('cancelled', String(form.get('reason') ?? ''))}
        className="flex flex-col gap-3"
      >
        <Textarea
          label="Почему отказываетесь"
          name="reason"
          rows={3}
          placeholder="Не успеваю в этот срок, занят на другом объекте"
          hint="Это прочитает клиент, который уже заплатил и ждёт"
          required
        />
        {error && (
          <p role="alert" className="text-body font-semibold text-err-strong">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" variant="danger" disabled={pending}>
            {pending ? 'Отправляем…' : 'Отказаться от заказа'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setAsking(false)}>
            Не надо
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-body font-semibold text-err-strong">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {row.nextAction && (
          <Button size="sm" disabled={pending} onClick={() => move(row.nextAction!.to)}>
            {pending ? 'Минуту…' : row.nextAction.label}
          </Button>
        )}
        {row.canCancel && (
          <Button size="sm" variant="ghost" onClick={() => setAsking(true)}>
            Отказаться
          </Button>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Textarea, cx } from '@/ui'
import type { DealRow } from '@/server/deal-queries'
import { moveDealAction } from '@/server/deal-actions'

/**
 * Что человек может сделать со своим заказом прямо сейчас.
 *
 * Главное действие ровно одно и оно сильнее остальных (§7.1). «Отменить»
 * и «Что-то не так» — рядом и слабее: это не то, ради чего сюда пришли.
 *
 * У отмены и спора обязательно спрашиваем причину: её читает вторая сторона
 * и оператор при разборе, и «отменено» без слов — это не объяснение.
 */
export function DealActions({ row }: { row: DealRow }) {
  const [asking, setAsking] = useState<'cancelled' | 'disputed' | null>(null)
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
      setAsking(null)
      // Без этого карточка останется со старым статусом до перезагрузки:
      // `revalidatePath` обновляет кэш на сервере, а не то, что уже на экране
      router.refresh()
    })
  }

  if (asking) {
    return (
      <form
        action={(form) => move(asking, String(form.get('reason') ?? ''))}
        className="flex flex-col gap-3"
      >
        <Textarea
          label={asking === 'cancelled' ? 'Почему отменяете' : 'Что пошло не так'}
          name="reason"
          rows={3}
          placeholder={
            asking === 'cancelled'
              ? 'Передумали, нашли своими силами'
              : 'Приехали, но сделали не то, о чём договаривались'
          }
          hint="Это прочитает подрядчик, а при споре — наш сотрудник"
          required
        />
        {error && (
          <p role="alert" className="text-body font-semibold text-err-strong">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" variant={asking === 'disputed' ? 'danger' : 'accent'} disabled={pending}>
            {pending ? 'Отправляем…' : asking === 'cancelled' ? 'Отменить заказ' : 'Заявить претензию'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setAsking(null)}>
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
      <div className={cx('flex flex-wrap items-center gap-2')}>
        {row.nextAction && (
          <Button size="sm" disabled={pending} onClick={() => move(row.nextAction!.to)}>
            {pending ? 'Минуту…' : row.nextAction.label}
          </Button>
        )}
        {row.canDispute && (
          <Button size="sm" variant="ghost" onClick={() => setAsking('disputed')}>
            Что-то не так
          </Button>
        )}
        {row.canCancel && (
          <Button size="sm" variant="ghost" onClick={() => setAsking('cancelled')}>
            Отменить
          </Button>
        )}
      </div>
    </div>
  )
}

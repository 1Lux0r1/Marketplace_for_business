'use client'

import { useState, useTransition } from 'react'
import { Button, cx } from '@/ui'
import { decideVerificationAction } from '@/server/catalog-actions'

/**
 * Решение оператора по одной заявке.
 *
 * Две кнопки, а не выпадающий список: решений ровно два, и прятать их
 * в список значит добавить лишнее нажатие на каждой строке.
 */
export function VerdictButtons({
  contractorId,
  orgName,
}: {
  contractorId: string
  orgName: string
}) {
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function decide(verified: boolean) {
    setResult(null)
    startTransition(async () => {
      const response = await decideVerificationAction({
        contractorId,
        verified,
        note: `Решение принято вручную по компании «${orgName}»`,
      })
      setResult(
        response.ok
          ? { ok: true, text: response.message ?? 'Записано' }
          : { ok: false, text: response.error },
      )
    })
  }

  if (result) {
    return (
      <span
        className={cx(
          'text-table font-semibold',
          result.ok ? 'text-accent-strong' : 'text-err-strong',
        )}
      >
        {result.text}
      </span>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={pending} onClick={() => decide(true)}>
        Подтвердить
      </Button>
      <Button size="sm" variant="danger" disabled={pending} onClick={() => decide(false)}>
        Отклонить
      </Button>
    </div>
  )
}

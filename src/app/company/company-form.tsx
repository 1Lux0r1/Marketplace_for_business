'use client'

import { useState, useTransition } from 'react'
import { Button, Drawer, Field } from '@/ui'
import type { CompanyCard } from '@/server/company-queries'
import { updateCompanyAction } from '@/server/company-actions'

/**
 * Реквизиты компании.
 *
 * ИНН и формы собственности здесь нет намеренно: по ИНН компанию опознают
 * и на него выписывают документы. Смена ИНН через форму настроек означала бы
 * подменить одно юрлицо другим, сохранив всю историю сделок и выплат.
 */
export function CompanyForm({
  company,
  onClose,
}: {
  company: CompanyCard
  onClose: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(form: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await updateCompanyAction({
        name: String(form.get('name') ?? ''),
        kpp: String(form.get('kpp') ?? ''),
        legalAddress: String(form.get('legalAddress') ?? ''),
      })
      if (result.ok) onClose()
      else setError(result.error)
    })
  }

  return (
    <Drawer open onClose={onClose} title="Реквизиты компании">
      <form action={submit} className="flex flex-col gap-5">
        <Field
          label="Название"
          name="name"
          defaultValue={company.name}
          hint="Как вас называть в документах и в переписке"
          required
        />
        <Field
          label="КПП"
          name="kpp"
          inputMode="numeric"
          className="num"
          defaultValue={company.kpp ?? ''}
          placeholder="770101001"
          hint="Девять цифр. У ИП и самозанятых его не бывает — оставьте пустым"
        />
        <Field
          label="Адрес"
          name="legalAddress"
          defaultValue={company.legalAddress ?? ''}
          placeholder="Москва, Тверская 12"
          hint="Юридический адрес — он попадёт в договор и счёт"
        />

        <p className="text-caption text-ink-3">
          ИНН {company.inn ?? 'не указан'} и форма собственности здесь не меняются:
          по ним вас опознают и на них выписывают документы. Если там ошибка — напишите нам.
        </p>

        {error && (
          <p role="alert" className="text-body font-semibold text-err-strong">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" block disabled={pending}>
          {pending ? 'Сохраняем…' : 'Сохранить'}
        </Button>
      </form>
    </Drawer>
  )
}

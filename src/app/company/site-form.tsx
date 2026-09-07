'use client'

import { useState, useTransition } from 'react'
import { Button, Drawer, Field } from '@/ui'
import type { SiteRow } from '@/server/company-queries'
import type { Zone } from '@/modules/catalog'
import { addSiteAction, updateSiteAction } from '@/server/company-actions'

/**
 * Точка: заведение и правка одной формой — поля те же, разница только в том,
 * есть ли что менять.
 *
 * Зона — список, а не поле ввода, и это не про удобство. Код зоны, набранный
 * руками, молча обнулил бы подбор: точка просто перестала бы находиться
 * подрядчиками, и никто бы не понял почему.
 */
export function SiteForm({
  zones,
  site,
  onClose,
}: {
  zones: Zone[]
  site?: SiteRow
  onClose: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(form: FormData) {
    setError(null)
    const fields = {
      name: String(form.get('name') ?? ''),
      address: String(form.get('address') ?? ''),
      zoneCode: String(form.get('zoneCode') ?? ''),
      contactName: String(form.get('contactName') ?? ''),
      contactPhone: String(form.get('contactPhone') ?? ''),
      note: String(form.get('note') ?? ''),
    }
    startTransition(async () => {
      const result = site
        ? await updateSiteAction({ siteId: site.id, ...fields })
        : await addSiteAction(fields)
      if (result.ok) onClose()
      else setError(result.error)
    })
  }

  return (
    <Drawer open onClose={onClose} title={site ? 'Изменить точку' : 'Новая точка'}>
      <form action={submit} className="flex flex-col gap-5">
        <Field
          label="Как называете точку"
          name="name"
          defaultValue={site?.name ?? ''}
          placeholder="Кофейня на Тверской"
          hint="Так, как называете её сами — по этому имени вы будете её узнавать в заказах"
          required
        />
        <Field
          label="Адрес"
          name="address"
          defaultValue={site?.address ?? ''}
          placeholder="Москва, Тверская 12, стр. 1"
          required
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="zoneCode" className="text-table font-semibold text-ink">
            Где это
          </label>
          <select
            id="zoneCode"
            name="zoneCode"
            defaultValue={site?.zoneCode ?? ''}
            required
            className="h-11 rounded-control border border-line-strong bg-surface px-3 text-body text-ink"
          >
            <option value="" disabled>
              Выберите округ
            </option>
            {zones.map((zone) => (
              <option key={zone.code} value={zone.code}>
                {zone.name}
              </option>
            ))}
          </select>
          <p className="text-caption text-ink-3">
            По этому мы находим подрядчиков, которые к вам поедут
          </p>
        </div>

        <Field
          label="Кому звонить на точке"
          name="contactName"
          defaultValue={site?.contactName ?? ''}
          placeholder="Ирина, администратор"
          hint="Если это не вы. Необязательно"
        />
        <Field
          label="Телефон на точке"
          name="contactPhone"
          type="tel"
          defaultValue={site?.contactPhone ?? ''}
          placeholder="+7 916 123-45-67"
        />
        <Field
          label="Как попасть внутрь"
          name="note"
          defaultValue={site?.note ?? ''}
          placeholder="Вход со двора, код домофона 1234, открыто с 8:00"
          hint="Всё, что подрядчику нужно знать заранее. Необязательно"
        />

        {error && (
          <p role="alert" className="text-body font-semibold text-err-strong">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" block disabled={pending}>
          {pending ? 'Сохраняем…' : site ? 'Сохранить' : 'Добавить точку'}
        </Button>
      </form>
    </Drawer>
  )
}

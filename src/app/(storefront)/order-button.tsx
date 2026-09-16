'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Button, Drawer, Field, SuccessNote, cx } from '@/ui'
import { orderFromCatalogAction } from '@/server/deal-actions'

/**
 * «Заказать» — основной путь клиента (§1) и единственное главное действие
 * на карточке услуги.
 *
 * Логика живёт здесь, а не в `catalog-view.tsx`: тот файл оформления, над ним
 * работает второй агент (§12), и правки вида не должны сталкиваться
 * с правками заказа в одном файле.
 *
 * Точки приходят пропсом со страницы, а не отдельным запросом. Запрос
 * означал бы роут, а роут не собирается в набор файлов без сервера —
 * демо на GitHub Pages сломалось бы на нём сразу.
 */
export type Site = { id: string; label: string; hint: string }

export function OrderButton({
  listingId,
  unit,
  minQty,
  sites,
}: {
  listingId: string
  unit: string
  minQty: string
  /** Точки вошедшего клиента. Пусто — он не вошёл или точек ещё нет. */
  sites: Site[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button size="lg" block onClick={() => setOpen(true)}>
        Заказать
      </Button>
      {open && (
        <OrderForm
          listingId={listingId}
          unit={unit}
          minQty={minQty}
          sites={sites}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function OrderForm({
  listingId,
  unit,
  minQty,
  sites,
  onClose,
}: {
  listingId: string
  unit: string
  minQty: string
  sites: Site[]
  onClose: () => void
}) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '')
  const [done, setDone] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(form: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await orderFromCatalogAction({
        listingId,
        siteId,
        qty: String(form.get('qty') ?? minQty),
      })
      if (result.ok) setDone(result.number ?? 0)
      else setError(result.error)
    })
  }

  if (done) {
    return (
      <Drawer open onClose={onClose} title="Заказ оформлен">
        <SuccessNote
          title={`Заказ №${done} оформлен`}
          description={
            <>
              Подрядчик его уже видит. Деньги вы переведёте площадке, и они будут
              лежать у нас, пока вы не примете работу.
            </>
          }
        />
        <div className="mt-5 flex flex-col gap-2">
          <Link
            href="/orders"
            className="inline-flex h-13 items-center justify-center rounded-control bg-accent px-6 text-lead font-semibold text-on-accent"
          >
            К моим заказам
          </Link>
        </div>
      </Drawer>
    )
  }

  return (
    <Drawer open onClose={onClose} title="Оформить заказ">
      {sites.length === 0 ? (
        <NoSites />
      ) : (
        <form action={submit} className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-table font-semibold text-ink">Куда приехать</legend>
            <div className="flex flex-col gap-2">
              {sites.map((site) => (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => setSiteId(site.id)}
                  aria-pressed={siteId === site.id}
                  className={cx(
                    'flex min-h-11 flex-col items-start gap-0.5 rounded-control border p-3 text-left transition-colors duration-150',
                    siteId === site.id
                      ? 'border-accent bg-accent-tint'
                      : 'border-line-strong hover:bg-surface-2',
                  )}
                >
                  <span className="text-body font-semibold text-ink">{site.label}</span>
                  <span className="text-caption text-ink-3">{site.hint}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <Field
            label={`Сколько нужно (${unit})`}
            name="qty"
            inputMode="decimal"
            className="num"
            defaultValue={minQty}
            hint={Number(minQty) > 1 ? `Подрядчик берётся от ${minQty} ${unit}` : undefined}
            required
          />

          {/* Обещание площадки — в момент, когда человек решается платить,
              а не в справке (§1) */}
          <p className="rounded-card border border-line bg-surface-2 p-3 text-caption text-ink-2">
            Оплата придёт площадке и будет лежать у нас до тех пор, пока вы
            не примете работу. Если что-то пойдёт не так, деньги не уйдут
            подрядчику, пока мы не разберёмся.
          </p>

          {error && (
            <p role="alert" className="text-body font-semibold text-err-strong">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" block disabled={pending || !siteId}>
            {pending ? 'Оформляем…' : 'Заказать'}
          </Button>
        </form>
      )}
    </Drawer>
  )
}

/**
 * Заказ всегда оформляется на точку. Пустое состояние здесь — навигация (§7.1):
 * оно ведёт туда, где точку заводят, а не сообщает о беде.
 */
function NoSites() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-body text-ink-2">
        Заказ оформляется на адрес, куда приедет подрядчик. Заведите точку —
        это займёт минуту, и дальше она будет подставляться сама.
      </p>
      <Link
        href="/company"
        className="inline-flex h-13 items-center justify-center rounded-control bg-accent px-6 text-lead font-semibold text-on-accent"
      >
        Завести точку
      </Link>
      <p className="text-caption text-ink-3">
        Если вы не вошли — сначала войдите: кнопка в правом верхнем углу.
      </p>
    </div>
  )
}

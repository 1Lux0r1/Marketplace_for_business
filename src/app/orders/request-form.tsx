'use client'

import { useState, useTransition } from 'react'
import { Button, Drawer, Field, SuccessNote, Textarea, cx } from '@/ui'
import type { Category } from '@/modules/catalog'
import { createRequestAction } from '@/server/request-actions'

/**
 * Форма заявки. НА ЭКРАНЕ У КЛИЕНТА СЛОВА «ЗАЯВКА» НЕТ (§7.1): для него это
 * задача, которую он просит сделать, а «заявка» — наше внутреннее слово.
 * В коде и у оператора — «заявка», здесь — «задача». Это проверяется тестом.
 *
 * Главное поле — свободный текст, и оно первое: задачу описывают именно
 * потому, что готовой карточки нет, и своими словами человеку проще,
 * чем раскладывать её по полям.
 *
 * Точка выбирается из списка, адрес руками не вводится: зона берётся из точки,
 * а код зоны с опечаткой молча обнулил бы подбор — заявку не увидел бы
 * ни один подрядчик, и никто бы не понял почему.
 */
const URGENCY = [
  { value: 'normal', label: 'В обычном порядке', hint: 'Подрядчики ответят в течение дня' },
  { value: 'urgent', label: 'Срочно', hint: 'Нужно сегодня или завтра' },
  { value: 'planned', label: 'Планово, к дате', hint: 'Есть срок, к которому надо успеть' },
] as const

type Urgency = (typeof URGENCY)[number]['value']

export function RequestForm({
  sites,
  categories,
  onClose,
}: {
  sites: Array<{ id: string; label: string; hint: string }>
  categories: Category[]
  onClose: () => void
}) {
  const [urgency, setUrgency] = useState<Urgency>('normal')
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '')
  const [done, setDone] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(form: FormData) {
    setError(null)
    startTransition(async () => {
      const categoryId = String(form.get('categoryId') ?? '')
      const result = await createRequestAction({
        siteId,
        rawText: String(form.get('rawText') ?? ''),
        ...(categoryId ? { categoryId } : {}),
        urgency,
        contactName: String(form.get('contactName') ?? ''),
        contactPhone: String(form.get('contactPhone') ?? ''),
        desiredAt: String(form.get('desiredAt') ?? ''),
      })
      if (result.ok) setDone(result.number ?? 0)
      else setError(result.error)
    })
  }

  if (done) {
    return (
      <Drawer open onClose={onClose} title="Задача отправлена">
        <SuccessNote
          title={`Задача №${done} отправлена`}
          description={
            <>
              Мы подберём подрядчиков и покажем вам их цены и сроки. Номер
              пригодится, если захотите о задаче написать или позвонить.
            </>
          }
        />
        <div className="mt-5">
          <Button type="button" size="lg" block onClick={onClose}>
            Понятно
          </Button>
        </div>
      </Drawer>
    )
  }

  return (
    <Drawer open onClose={onClose} title="Опишите задачу">
      <form action={submit} className="flex flex-col gap-5">
        <Textarea
          label="Что нужно сделать"
          name="rawText"
          rows={5}
          placeholder="Нужна санобработка от тараканов на кухне. Работать можно только после закрытия, после 23:00."
          hint="Своими словами. Чем понятнее задача, тем точнее подрядчики назовут цену"
          required
        />

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

        <div className="flex flex-col gap-1.5">
          <label htmlFor="categoryId" className="text-table font-semibold text-ink">
            Категория
          </label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue=""
            className="h-11 rounded-control border border-line-strong bg-surface px-3 text-body text-ink"
          >
            <option value="">Не знаю, подберите сами</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <p className="text-caption text-ink-3">
            Необязательно: если не уверены, оставьте как есть — разберёмся мы
          </p>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-table font-semibold text-ink">Насколько срочно</legend>
          <div className="flex flex-col gap-2">
            {URGENCY.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setUrgency(option.value)}
                aria-pressed={urgency === option.value}
                className={cx(
                  'flex min-h-11 flex-col items-start gap-0.5 rounded-control border p-3 text-left transition-colors duration-150',
                  urgency === option.value
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

        {urgency === 'planned' && (
          <Field label="К какой дате" name="desiredAt" type="date" />
        )}

        <Field
          label="Кто встретит"
          name="contactName"
          placeholder="Ирина, администратор"
          hint="Если это не вы. По умолчанию возьмём контакт с точки"
        />
        <Field label="Телефон на месте" name="contactPhone" type="tel" placeholder="+7 916 123-45-67" />

        {error && (
          <p role="alert" className="text-body font-semibold text-err-strong">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" block disabled={pending}>
          {pending ? 'Отправляем…' : 'Отправить'}
        </Button>
      </form>
    </Drawer>
  )
}

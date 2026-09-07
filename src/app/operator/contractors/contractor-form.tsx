'use client'

import { useState, useTransition } from 'react'
import { Button, Field, cx } from '@/ui'
import type { Category, ContractorStatus, Zone } from '@/modules/catalog'
import { createContractorAction, updateContractorAction } from '@/server/catalog-actions'

/**
 * Заведение и правка подрядчика — один экран целиком: компания, статус,
 * категории и зоны. Критерий приёмки задачи 01-4 именно такой, и он разумный:
 * подрядчик без категорий и зон бесполезен, а сохранять его в три захода
 * значит гарантированно копить недозаполненные записи.
 *
 * Оператор знает системные термины (§7.1), поэтому «статус» и «категории»
 * здесь называются своими именами.
 */

const STATUSES: Array<{ value: ContractorStatus; label: string; hint: string }> = [
  { value: 'draft', label: 'Черновик', hint: 'заведён, но не получает заявок' },
  { value: 'active', label: 'Активен', hint: 'получает предложения по заявкам' },
  { value: 'paused', label: 'На паузе', hint: 'временно не беспокоить' },
  { value: 'blocked', label: 'Заблокирован', hint: 'нарушения, разбирается спор' },
]

type Props = {
  categories: Category[]
  zones: Zone[]
  existing?: {
    id: string
    orgName: string
    inn: string | null
    status: ContractorStatus
    categoryIds: string[]
    zoneCodes: string[]
  }
}

export function ContractorForm({ categories, zones, existing }: Props) {
  const [status, setStatus] = useState<ContractorStatus>(existing?.status ?? 'draft')
  const [categoryIds, setCategoryIds] = useState<string[]>(existing?.categoryIds ?? [])
  const [zoneCodes, setZoneCodes] = useState<string[]>(existing?.zoneCodes ?? [])
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(form: FormData) {
    setResult(null)
    startTransition(async () => {
      const response = existing
        ? await updateContractorAction({
            contractorId: existing.id,
            status,
            categoryIds,
            zoneCodes,
          })
        : await createContractorAction({
            inn: String(form.get('inn') ?? ''),
            status,
            manualRating: String(form.get('manualRating') ?? '') || undefined,
            notes: String(form.get('notes') ?? ''),
            categoryIds,
            zoneCodes,
          })

      setResult(
        response.ok
          ? { ok: true, text: response.message ?? 'Сохранено' }
          : { ok: false, text: response.error },
      )
    })
  }

  return (
    <form action={submit} className="flex max-w-[720px] flex-col gap-6">
      {existing ? (
        <div className="rounded-card border border-line bg-surface-2 px-4 py-3">
          <div className="text-table font-bold">{existing.orgName}</div>
          {existing.inn && <div className="num text-caption text-ink-3">ИНН {existing.inn}</div>}
        </div>
      ) : (
        <Field
          label="ИНН компании"
          name="inn"
          inputMode="numeric"
          className="num"
          placeholder="7701234567"
          hint="Компания должна быть уже зарегистрирована — заводить её отсюда нельзя"
          required
        />
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-table font-semibold text-ink">Статус</legend>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setStatus(option.value)}
              aria-pressed={status === option.value}
              title={option.hint}
              className={cx(
                'h-11 rounded-control border px-4 text-body font-semibold transition-colors duration-150',
                status === option.value
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-line-strong bg-surface text-ink-2 hover:bg-surface-2',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-caption text-ink-3">
          {STATUSES.find((s) => s.value === status)?.hint}
        </p>
      </fieldset>

      <Picker
        title="Категории"
        empty="Категорий пока нет — их заводит сид"
        hint="Без категорий подрядчик не попадёт ни в один подбор"
        options={categories.map((c) => ({ value: c.id, label: c.name }))}
        selected={categoryIds}
        onToggle={setCategoryIds}
      />

      <Picker
        title="Зоны обслуживания"
        empty="Зон нет"
        hint="«Москва целиком» покрывает все округа — отдельно их отмечать не нужно"
        options={zones.map((z) => ({ value: z.code, label: z.name }))}
        selected={zoneCodes}
        onToggle={setZoneCodes}
      />

      {!existing && (
        <>
          <Field
            label="Рейтинг"
            name="manualRating"
            type="number"
            min={1}
            max={5}
            className="num"
            hint="От 1 до 5. По нему подрядчики выстраиваются в подборе"
          />
          <Field label="Заметки" name="notes" placeholder="Что важно помнить об этом подрядчике" />
        </>
      )}

      {result && (
        <p
          role="alert"
          className={cx(
            'text-body font-semibold',
            result.ok ? 'text-accent-strong' : 'text-err-strong',
          )}
        >
          {result.text}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? 'Сохраняем…' : existing ? 'Сохранить' : 'Завести подрядчика'}
      </Button>
    </form>
  )
}

/**
 * Выбор из списка галочками. Не выпадающий список: оператору нужно видеть
 * всё сразу и отмечать несколько, а не открывать список по одному пункту.
 */
function Picker({
  title,
  hint,
  empty,
  options,
  selected,
  onToggle,
}: {
  title: string
  hint: string
  empty: string
  options: Array<{ value: string; label: string }>
  selected: string[]
  onToggle: (next: string[]) => void
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-table font-semibold text-ink">
        {title}
        {selected.length > 0 && (
          <span className="ml-2 font-medium text-ink-3">выбрано {selected.length}</span>
        )}
      </legend>

      {options.length === 0 ? (
        <p className="text-body text-ink-3">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const active = selected.includes(option.value)
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onToggle(
                    active
                      ? selected.filter((v) => v !== option.value)
                      : [...selected, option.value],
                  )
                }
                className={cx(
                  'min-h-11 rounded-pill border px-4 text-table font-semibold transition-colors duration-150',
                  active
                    ? 'border-accent bg-accent-tint text-accent-strong'
                    : 'border-line-strong bg-surface text-ink-2 hover:bg-surface-2',
                )}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      )}
      <p className="text-caption text-ink-3">{hint}</p>
    </fieldset>
  )
}

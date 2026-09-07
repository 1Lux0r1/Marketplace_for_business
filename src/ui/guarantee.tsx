import type { ReactNode } from 'react'
import { ShieldIcon, LockIcon } from './icons'

/**
 * Обещание площадки на витрине.
 *
 * Это не украшение экрана: удержание денег до приёмки — то, за что берётся
 * комиссия, и единственное, чего не скопируют вместе с каталогом (§1).
 * Поэтому оно стоит там, где человек выбирает, а не там, где он уже заплатил.
 *
 * Бирюзовая подложка, а не оранжевая: это не выгода и не статус, а спокойное
 * обещание. Оранжевый здесь был бы ошибкой того же рода, что зелёная кнопка
 * «Сохранить» (§7.2).
 */
export function GuaranteeBand({ action }: { action?: ReactNode }) {
  return (
    <aside className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-accent bg-accent-tint px-5 py-4">
      <span className="flex-none text-accent-strong">
        <ShieldIcon size={22} />
      </span>
      <p className="min-w-0 flex-1 text-body text-ink">
        <strong className="font-bold">Деньги лежат у нас, пока вы не примете работу.</strong>{' '}
        <span className="text-ink-2">
          Договор, счёт и акт выпустим мы. Если что-то пойдёт не так — разбираемся тоже мы,
          а не вы с подрядчиком.
        </span>
      </p>
      {action && <div className="flex-none">{action}</div>}
    </aside>
  )
}

/**
 * Та же мысль одной строкой — для мест, где на плашку нет места:
 * подвал карточки услуги, шапка списка заказов.
 */
export function GuaranteeLine() {
  return (
    <p className="flex items-center gap-2 text-caption text-ink-3">
      <LockIcon size={15} />
      Деньги подрядчику уходят только после подписанного акта
    </p>
  )
}

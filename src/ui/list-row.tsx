import type { ReactNode } from 'react'
import { cx } from './cx'

/**
 * Строка списка: карточка услуги в кабинете подрядчика, подрядчик в списке
 * оператора, объект в кабинете клиента.
 *
 * Карточки, а не таблица: таблица нужна там, где колонки сравнивают взглядом
 * (суммы, даты), а здесь у каждой строки своя разнородная начинка. Таблица
 * из неё получилась бы с пустыми ячейками и читалась бы как учётная программа
 * (§7).
 *
 * **Действия — видимые кнопки, а не появляющиеся при наведении.** На тач-устройстве
 * наведения нет вообще, и спрятанное там действие недоступно навсегда (§7.5).
 *
 * **У статуса, суммы и действий свои полосы одинаковой ширины.** Без этого
 * строка с одной кнопкой сдвигает свою сумму вправо относительно строки
 * с двумя, и колонка сумм перестаёт читаться сверху вниз — а §7.3 требует,
 * чтобы суммы и статусы выравнивались одинаково во всех списках системы.
 * На узком экране полосы отключаются и всё переносится по строкам.
 */
export function ListRow({
  title,
  href,
  meta,
  status,
  amount,
  actions,
}: {
  title: ReactNode
  /** Вся строка становится ссылкой на карточку. Кнопки действий при этом работают сами. */
  href?: string
  /** Вторая строка: категория, зона, дата — то, по чему строку узнают. */
  meta?: ReactNode
  status?: ReactNode
  /** Сумма. Табличными цифрами и справа — одинаково во всех списках (§7.3). */
  amount?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line px-[18px] py-3.5 first:border-t-0 hover:bg-surface-2">
      <div className="min-w-[12rem] flex-1">
        <div className="text-body font-bold text-ink">
          {href ? (
            <a href={href} className="hover:text-accent-strong">
              {title}
            </a>
          ) : (
            title
          )}
        </div>
        {meta && <div className="mt-1 text-caption text-ink-3">{meta}</div>}
      </div>

      {status && <div className="flex-none md:w-44">{status}</div>}
      {amount && (
        <div className={cx('num flex-none text-table font-semibold whitespace-nowrap md:w-24 md:text-right')}>
          {amount}
        </div>
      )}
      {actions && (
        <div className="flex flex-none flex-wrap items-center gap-2 md:w-56 md:justify-end">{actions}</div>
      )}
    </div>
  )
}

/** Рамка вокруг списка строк: та же поверхность и тень, что у таблицы. */
export function ListFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card">
      {children}
    </div>
  )
}

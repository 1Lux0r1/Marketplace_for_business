import { cx } from './cx'

/**
 * Оценка подрядчика.
 *
 * Показывается только когда она есть. Ноль или прочерк на месте оценки читается
 * как «плохой подрядчик», хотя означает «ещё никто не оценивал» — а на витрине
 * это разница между «закажу» и «не закажу».
 *
 * Звезда графитовая, а не жёлтая: жёлтый в палитре занят выгодой, и звезда
 * этого цвета читалась бы как скидка (§7.2).
 */
export function Rating({ value, className }: { value: number | null; className?: string }) {
  if (value === null) return null

  return (
    <span className={cx('inline-flex items-center gap-1 text-caption text-ink-2', className)}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.6 9.7l5.8-.8z" />
      </svg>
      <span className="num font-semibold">{value.toFixed(1).replace('.', ',')}</span>
    </span>
  )
}

/**
 * Отметка проверенного ИНН.
 *
 * Мелкая и рядом с названием компании, а не бейджем в углу карточки: это
 * свойство подрядчика, а не статус услуги. Бейджем оно перетягивало бы
 * на себя внимание с цены и названия.
 */
export function VerifiedMark({ label = 'проверен' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-caption font-semibold text-ok-strong">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M20 6.5L9.5 17.5 4 12" />
      </svg>
      {label}
    </span>
  )
}

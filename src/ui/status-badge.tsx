import type { ReactNode } from 'react'
import { cx } from './cx'

/**
 * Статус — это цвет И текст (§7.2). Одним цветом статус не читается
 * ни в чёрно-белой печати, ни при дальтонизме, поэтому `children` обязателен.
 *
 * `promo` сюда не входит: оранжевый — про выгоду, а не про состояние.
 */
type Tone = 'ok' | 'warn' | 'err' | 'neutral'

const tones: Record<Tone, string> = {
  ok: 'bg-ok-tint text-ok-strong',
  warn: 'bg-warn-tint text-warn-strong',
  err: 'bg-err-tint text-err-strong',
  neutral: 'bg-neutral-tint text-neutral-strong',
}

const dots: Record<Tone, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  err: 'bg-err',
  neutral: 'bg-neutral',
}

export function StatusBadge({
  tone = 'neutral',
  children,
}: {
  tone?: Tone
  children: ReactNode
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-2 rounded-control px-2.5 py-1 text-caption font-semibold',
        tones[tone],
      )}
    >
      <span className={cx('size-1.5 shrink-0 rounded-full', dots[tone])} aria-hidden />
      {children}
    </span>
  )
}

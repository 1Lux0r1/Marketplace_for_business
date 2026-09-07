'use client'

import Link from 'next/link'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

/**
 * На экране ровно одно главное действие, визуально сильнее остальных (§7.1).
 *
 * Текст на бирюзовой заливке — графитовый, а не белый: белый по #00a699 даёт
 * контраст 3,05:1 и не проходит §7.6, графитовый даёт 4,84:1.
 *
 * `promo` — только про выгоду и тарифы, никогда не про действие (§7.2).
 */
type Variant = 'accent' | 'ghost' | 'quiet' | 'danger' | 'promo'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  accent: 'bg-accent text-on-accent border-accent hover:brightness-95',
  ghost: 'bg-transparent text-ink border-line-strong hover:bg-surface-2',
  quiet: 'bg-surface-3 text-ink border-transparent hover:brightness-95',
  danger: 'bg-transparent text-err-strong border-err hover:bg-err-tint',
  promo: 'bg-promo text-on-promo border-promo hover:brightness-95',
}

// Ниже 44px не опускаемся: это минимальная целевая область (§7.5)
const sizes: Record<Size, string> = {
  sm: 'h-11 px-3.5 text-table',
  md: 'h-11 px-[18px] text-body',
  lg: 'h-13 px-6 text-lead',
}

type Common = {
  variant?: Variant
  size?: Size
  block?: boolean
  className?: string
  children?: ReactNode
}

type Props =
  | (Common & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined })
  | (Common & { href: string })

const base =
  'inline-flex items-center justify-center gap-2 rounded-control border font-semibold ' +
  'transition-[filter,background-color] duration-150 disabled:opacity-50 disabled:pointer-events-none'

export function Button(props: Props) {
  const { variant = 'accent', size = 'md', block = false, className } = props
  const look = cx(base, variants[variant], sizes[size], block && 'w-full', className)

  if (props.href !== undefined) {
    return (
      <Link href={props.href} className={look}>
        {props.children}
      </Link>
    )
  }

  const { variant: _v, size: _s, block: _b, className: _c, href: _h, type = 'button', ...rest } = props
  return <button type={type} className={look} {...rest} />
}

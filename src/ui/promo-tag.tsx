import type { ReactNode } from 'react'
/**
 * Оранжевый — только про выгоду, и всегда со словом (§7.2).
 * Поэтому здесь нет варианта «просто подсветить»: текст обязателен.
 */
export function PromoTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-[7px] bg-promo px-2.5 py-1 text-caption font-extrabold text-on-promo">
      {children}
    </span>
  )
}

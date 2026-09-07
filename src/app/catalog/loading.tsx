import { LoadingRows } from '@/ui'

/**
 * Состояние загрузки: скелет структуры, а не крутящийся спиннер (§7.4).
 * Человек должен видеть, что сейчас появится, а не что «что-то происходит».
 */
export default function CatalogLoading() {
  return (
    <>
      <div className="h-8 w-52 animate-pulse rounded-control bg-surface-3" />
      <div className="h-11 w-full max-w-[620px] animate-pulse rounded-pill bg-surface-3" />
      <LoadingRows rows={6} />
    </>
  )
}

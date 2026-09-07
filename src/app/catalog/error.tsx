'use client'

import { Button, ErrorState } from '@/ui'

/**
 * Состояние ошибки (§7.4): что случилось и что делать, с кнопкой повтора.
 * Без извинений и без кода ошибки без объяснения.
 */
export default function CatalogError({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState
      title="Витрина не загрузилась"
      description="Похоже, база недоступна. Обычно помогает повторить через несколько секунд."
      action={<Button onClick={reset}>Повторить</Button>}
    />
  )
}

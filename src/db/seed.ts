import { config } from '@/shared/config'

/**
 * Демо-данные для разработки и демо-режима.
 *
 * ОТДЕЛЬНАЯ база, не смешивать с рабочей (docs/03-data-model.md).
 * Наполнение появится в 01-4: 12 категорий первой волны, зоны по округам Москвы,
 * подрядчики, организации-клиенты, пользователь-оператор.
 */
async function main(): Promise<void> {
  const cfg = config()
  if (cfg.NODE_ENV === 'production') {
    throw new Error('db:seed в проде запускать нельзя: это демо-данные, а не миграция')
  }
  console.log('Пока нечего засеивать: таблицы появятся в задачах 01-2 и 01-4')
}

main().catch((error: unknown) => {
  console.error('Сид не отработал:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})

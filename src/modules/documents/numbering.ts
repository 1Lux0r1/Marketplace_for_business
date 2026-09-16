import { and, eq, sql } from 'drizzle-orm'
import type { Executor } from '@/shared/db'
import { counters } from './schema'
import type { DocumentKind } from './types'

/**
 * Номер документа без пропусков и дублей (§8).
 *
 * ПОЧЕМУ НЕ ПОСЛЕДОВАТЕЛЬНОСТЬ БАЗЫ. Она даёт уникальность, но не даёт
 * непрерывность: откат транзакции номер не возвращает. Для внутреннего
 * идентификатора это нормально, для счёта — нет. Пропуск в нумерации счетов
 * придётся объяснять бухгалтеру и проверяющему, а объяснение «программа
 * так устроена» их не устраивает.
 *
 * Здесь номер берётся из строки счётчика под блокировкой и растёт в той же
 * транзакции, что и сам документ. Откат возвращает и номер: следующий
 * документ получит тот же.
 *
 * ЦЕНА: выдача документов одного вида идёт по одному — вторая ждёт первую.
 * При наших объёмах это незаметно. Если когда-нибудь счета начнут выпускаться
 * сотнями в секунду, придётся выбирать между непрерывностью и скоростью;
 * тогда это будет осознанный выбор, а не сюрприз.
 */

const PREFIX: Record<DocumentKind, string> = {
  contract: 'ДГ',
  invoice: 'СЧ',
  act: 'АКТ',
}

/**
 * Взять следующий номер. ОБЯЗАТЕЛЬНО в той же транзакции, что и документ,
 * иначе непрерывность теряется — ради неё всё и написано.
 */
export async function nextNumber(
  exec: Executor,
  kind: DocumentKind,
  now: Date = new Date(),
): Promise<string> {
  // Год по Москве: счета нумеруются по календарю страны, а не по UTC.
  // 1 января в 02:00 по Москве — это ещё 31 декабря по UTC, и счёт ушёл бы
  // в нумерацию прошлого года
  const year = Number(
    new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', year: 'numeric' }).format(now),
  )

  // Заводим счётчик года, если его ещё нет, и сразу блокируем строку:
  // `on conflict do nothing` и последующий `for update` дают одну строку
  // даже когда два документа выпускаются одновременно
  await exec
    .insert(counters)
    .values({ kind, year, next: 1 })
    .onConflictDoNothing({ target: [counters.kind, counters.year] })

  const [row] = await exec
    .select()
    .from(counters)
    .where(and(eq(counters.kind, kind), eq(counters.year, year)))
    .for('update')

  const value = row?.next ?? 1
  await exec
    .update(counters)
    .set({ next: sql`${counters.next} + 1` })
    .where(and(eq(counters.kind, kind), eq(counters.year, year)))

  return `${PREFIX[kind]}-${year}-${String(value).padStart(6, '0')}`
}

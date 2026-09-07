import { afterAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { closeDb, getDb } from './db'

/**
 * База должна уметь приводить кириллицу к одному регистру.
 *
 * Это не придирка. Поиск по каталогу — основной путь клиента (§1) — сравнивает
 * запрос с названием и описанием через `ilike`, а он для не-латиницы опирается
 * на локаль базы. На локали `C` «Генеральная уборка» не находится по слову
 * «генеральная»: не с ошибкой, а пустым списком. Клиент видит «ничего не нашлось»
 * и уходит, а в журналах всё чисто.
 *
 * Поймано 07.09.2026 на своей машине: база была создана с `--locale=C`,
 * и падал ровно один тест каталога. На сервере это выглядело бы как
 * «поиск не работает», без единой подсказки почему.
 *
 * Проверка стоит здесь, а не в модуле каталога: она про окружение, а не про
 * его код, и должна падать раньше — на первом же прогоне в новой среде.
 */
afterAll(async () => {
  await closeDb()
})

describe('база подходит для русского текста', () => {
  it('приводит кириллицу к одному регистру — иначе поиск молча не работает', async () => {
    const db = getDb()
    const [row] = await db.execute<{ folds: boolean }>(
      sql`select ('Генеральная уборка' ilike '%генеральная%') as folds`,
    )

    expect(
      row?.folds,
      'База создана с локалью, в которой не работает регистр кириллицы. ' +
        'Пересоздайте её с UTF-8: initdb --locale=C.utf8 --encoding=UTF8, ' +
        'или createdb --locale=ru_RU.utf8 --template=template0. ' +
        'Требование записано в docs/08-server-requirements.md.',
    ).toBe(true)
  })

  it('хранит текст в UTF-8: иначе кириллица не доедет до базы целой', async () => {
    const db = getDb()
    const [row] = await db.execute<{ encoding: string }>(
      sql`select pg_encoding_to_char(encoding) as encoding
          from pg_database where datname = current_database()`,
    )

    expect(row?.encoding).toBe('UTF8')
  })
})

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Права оператора: проверка структурная, а не поведенческая.
 *
 * Права проверяются функциями, которые читают куку запроса, и по одной их
 * проверять — значит поднимать половину Next в тестах. Но опасна здесь не
 * логика самой проверки (она в три строки), а то, что новый экран или новую
 * команду напишут без неё. Это и проверяется: файл появился — либо в нём есть
 * `requireOperator`, либо он назван публичным здесь, в списке, который видно
 * на ревью.
 *
 * Тест обязателен по §8: права доступа — одна из трёх областей, где тесты
 * не по желанию.
 */

const ROOT = join(import.meta.dirname, '..')

/**
 * Команды, у которых проверки прав не должно быть, и почему.
 * Каждая строка — осознанное решение, а не забытая проверка.
 */
const PUBLIC_ACTIONS: Record<string, string> = {
  joinAsContractorAction:
    'подрядчик заводит себя сам, до регистрации он в системе никто (решение Q10)',
}

function read(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8')
}

describe('права оператора', () => {
  it('каждая команда экранов оператора проверяет права или названа публичной', () => {
    const code = read('server/catalog-actions.ts')
    const unguarded: string[] = []

    // Тело функции — от её объявления до следующего `export ` на нулевом отступе
    for (const match of code.matchAll(/export async function (\w+Action)\b/gu)) {
      const name = match[1] as string
      const start = match.index
      const rest = code.slice(start + 1)
      const end = rest.search(/\nexport /u)
      const body = end === -1 ? rest : rest.slice(0, end)

      if (body.includes('requireOperator()')) continue
      if (name in PUBLIC_ACTIONS) continue
      unguarded.push(name)
    }

    expect(unguarded, 'команда без проверки прав: добавьте requireOperator() или строку в PUBLIC_ACTIONS').toEqual([])
  })

  it('каждый экран оператора проверяет права до чтения данных', () => {
    const dir = join(ROOT, 'app/operator')
    const pages = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join('app/operator', entry.name, 'page.tsx'))

    expect(pages.length, 'экраны оператора не найдены — тест смотрит не туда').toBeGreaterThan(0)

    const unguarded = pages.filter((page) => !read(page).includes('requireOperator()'))
    expect(unguarded, 'экран оператора без проверки прав').toEqual([])
  })

  it('заглушки для демо отдают ровно то же, что настоящие файлы', () => {
    // Демо собирается подменой файлов (см. next.config.ts). Пропущенная
    // функция валит сборку демо, а не тесты, и обнаруживается через час
    const pairs = [
      ['server/catalog-queries.ts', 'server/catalog-queries.demo.ts'],
      ['server/catalog-actions.ts', 'server/catalog-actions.demo.ts'],
      ['server/auth-actions.ts', 'server/auth-actions.demo.ts'],
      ['server/session.ts', 'server/session.demo.ts'],
      ['server/storefront-queries.ts', 'server/storefront-queries.demo.ts'],
      ['server/company-queries.ts', 'server/company-queries.demo.ts'],
      ['server/company-actions.ts', 'server/company-actions.demo.ts'],
    ]

    for (const [real, demo] of pairs as Array<[string, string]>) {
      expect(exportedNames(read(real)).filter((n) => !exportedNames(read(demo)).includes(n)), `${demo} не отдаёт всё, что ${real}`).toEqual([])
    }
  })

  it('каждая команда кабинета спрашивает, кто пришёл', () => {
    // Кабинет — это чужие точки и чужие реквизиты. Команда без `requireUser`
    // выполнилась бы от имени никого, а модуль решает по человеку, кто пришёл
    const code = read('server/company-actions.ts')
    const unguarded: string[] = []

    for (const match of code.matchAll(/export async function (\w+Action)\b/gu)) {
      const name = match[1] as string
      const rest = code.slice((match.index as number) + 1)
      const end = rest.search(/\nexport /u)
      const body = end === -1 ? rest : rest.slice(0, end)
      if (!body.includes('requireUser()')) unguarded.push(name)
    }

    expect(unguarded, 'команда кабинета без requireUser()').toEqual([])
  })

  /**
   * Подмена файлов на сборке демо работает по списку в `next.config.ts`.
   * Забытая пара — это не падение тестов, а падение сборки демо через час.
   */
  it('каждая заглушка перечислена в next.config.ts', () => {
    const config = read('../next.config.ts')
    const stubs = readdirSync(join(ROOT, 'server'))
      .filter((file) => file.endsWith('.demo.ts'))
      .map((file) => file.replace('.demo.ts', ''))

    const missing = stubs.filter((name) => !config.includes(name))
    expect(missing, 'заглушка есть, а в next.config.ts её нет').toEqual([])
  })

  it('заглушка прав для демо никого не пускает', () => {
    // В демо нет ни базы, ни сессий: «разрешено» здесь было бы дырой
    // в наборе файлов, который лежит в открытом доступе
    expect(read('server/catalog-queries.demo.ts')).toContain('allowed: false')
    expect(read('server/catalog-queries.demo.ts')).not.toContain('allowed: true')
  })
})

/** Имена, которые файл отдаёт наружу: функции, значения и типы. */
function exportedNames(code: string): string[] {
  const names = new Set<string>()

  for (const m of code.matchAll(/export (?:async )?function (\w+)/gu)) names.add(m[1] as string)
  for (const m of code.matchAll(/export (?:const|let|type) (\w+)/gu)) names.add(m[1] as string)
  for (const m of code.matchAll(/export type \{([^}]+)\}/gu)) {
    for (const part of (m[1] as string).split(',')) {
      const name = part.trim().split(/\s+as\s+/u).pop()?.trim()
      if (name) names.add(name)
    }
  }

  return [...names]
}

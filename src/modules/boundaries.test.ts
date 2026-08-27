import { describe, expect, it } from 'vitest'
import { ESLint } from 'eslint'

/**
 * Границы модулей (§4) проверяются линтером, а не договорённостью.
 *
 * Это критерий приёмки задачи 01-1: попытка импортировать
 * `modules/platform/service` из другого модуля должна падать. Тест держит
 * правило живым — конфиг линтера легко сломать, не заметив.
 */
// Проверяем правило на несуществующих путях, поэтому типовая информация не нужна
// и мешает: projectService потребовал бы, чтобы файл лежал в tsconfig.
const lint = new ESLint({
  cwd: new URL('../..', import.meta.url).pathname,
  overrideConfig: [
    { languageOptions: { parserOptions: { projectService: false, project: null } } },
  ],
})

async function messagesFor(code: string, filePath: string): Promise<string[]> {
  const [result] = await lint.lintText(code, { filePath })
  return (result?.messages ?? []).map((m) => `${m.ruleId ?? '?'}: ${m.message}`)
}

const inCatalog = 'src/modules/catalog/service.ts'

describe('границы модулей', () => {
  it('импорт внутренностей чужого модуля запрещён', async () => {
    const messages = await messagesFor(
      `import { getOrg } from '@/modules/platform/service'\nexport const x = getOrg\n`,
      inCatalog,
    )
    expect(messages.join('\n')).toContain('no-restricted-imports')
  })

  it('импорт чужой схемы запрещён — JOIN между схемами так и появляется', async () => {
    const messages = await messagesFor(
      `import { orgs } from '@/modules/platform/schema'\nexport const x = orgs\n`,
      inCatalog,
    )
    expect(messages.join('\n')).toContain('no-restricted-imports')
  })

  it('обход алиаса относительным путём тоже запрещён', async () => {
    const messages = await messagesFor(
      `import { getOrg } from '../platform/service'\nexport const x = getOrg\n`,
      inCatalog,
    )
    expect(messages.join('\n')).toContain('no-restricted-imports')
  })

  it('импорт публичного интерфейса соседа разрешён', async () => {
    const messages = await messagesFor(
      `import type { Role } from '@/modules/platform'\nexport type R = Role\n`,
      inCatalog,
    )
    expect(messages.join('\n')).not.toContain('no-restricted-imports')
  })

  it('внутри своего модуля относительные импорты разрешены', async () => {
    const messages = await messagesFor(
      `import { platform } from './schema'\nexport const s = platform\n`,
      inCatalog,
    )
    expect(messages.join('\n')).not.toContain('no-restricted-imports')
  })

  it('правило действует и в app, и в worker, а не только между модулями', async () => {
    for (const filePath of ['src/app/page.tsx', 'src/worker/index.ts']) {
      const messages = await messagesFor(
        `import { getOrg } from '@/modules/platform/service'\nexport const x = getOrg\n`,
        filePath,
      )
      expect(messages.join('\n'), filePath).toContain('no-restricted-imports')
    }
  })
})

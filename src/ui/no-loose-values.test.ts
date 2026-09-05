import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * «Ни одного цвета или размера „по месту“ в компонентах» (§7.2) — это условие
 * того, что смена брендинга (Q6) занимает час, а не неделю. Правило проверяемое,
 * поэтому проверяется здесь, а не держится в голове.
 *
 * Ограничения раскладки (`max-w-[66ch]`, `min-w-[720px]`) под запрет не попадают:
 * это не палитра и не шкала, а ширина колонки текста и минимум для таблицы.
 * Запрещено ровно то, для чего токены есть: цвет, радиус и кегль.
 */
const roots = ['src/ui', 'src/app']

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return tsxFiles(path)
    return path.endsWith('.tsx') ? [path] : []
  })
}

const files = roots.flatMap(tsxFiles)

const forbidden: Array<[string, RegExp, string]> = [
  ['цвет прямо в разметке', /#[0-9a-f]{3,8}\b(?![^<]*<\/)/gi, 'цвета живут в токенах globals.css'],
  ['радиус мимо шкалы', /\brounded-\[[^\]]+\]/g, 'есть rounded-control, rounded-card, rounded-pill'],
  ['кегль мимо шкалы', /\btext-\[[^\]]+\]/g, 'размеры только из шкалы §7.3'],
]

describe('значения «по месту» (§7.2)', () => {
  it('файлы для проверки нашлись', () => {
    expect(files.length).toBeGreaterThan(4)
  })

  it.each(forbidden)('нигде нет: %s', (_label, pattern, hint) => {
    const hits: string[] = []
    for (const file of files) {
      // Комментарии не считаем: в них цвет объясняют, а не применяют
      const code = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
      for (const m of code.matchAll(pattern)) hits.push(`${file}: ${m[0]}`)
    }
    expect(hits, `${hits.join(', ')} — ${hint}`).toEqual([])
  })
})

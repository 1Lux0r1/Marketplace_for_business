/**
 * Сборка демо для GitHub Pages.
 *
 * Отдельным файлом, а не строкой в package.json, потому что переменную
 * окружения Windows и Linux задают по-разному: `DEMO_EXPORT=1 next build`
 * работает только на Linux и macOS, а собирать проект нужно на обеих.
 */
import { spawnSync } from 'node:child_process'

// shell нужен на Windows: там исполняемый файл называется next.cmd,
// и без оболочки его не находят
const result = spawnSync('next', ['build'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DEMO_EXPORT: '1' },
})

process.exit(result.status ?? 1)

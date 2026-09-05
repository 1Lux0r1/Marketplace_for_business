import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

/**
 * Границы модулей (§4 CLAUDE.md) — главное правило этого конфига.
 *
 * Сосед виден только через `modules/<name>/index.ts`. Импорт `@/modules/deal/service`
 * из другого модуля, из app или из worker падает здесь, а не всплывает через полгода,
 * когда модуль будут выносить в сервис.
 *
 * Внутри своего модуля импорты относительные (`./service`, `./schema`) — они
 * под это правило не попадают и попадать не должны.
 */
const crossModuleImport = {
  group: ['@/modules/*/*'],
  message:
    'Сосед виден только через modules/<name>/index.ts. Импорт из service.ts, ' +
    'schema.ts и прочих внутренностей чужого модуля запрещён (CLAUDE.md §4.4). ' +
    'Внутри своего модуля используй относительный путь: ./service.',
}

const moduleBoundaries = {
  name: 'project/module-boundaries',
  files: ['**/*.ts', '**/*.tsx'],
  rules: {
    'no-restricted-imports': ['error', { patterns: [crossModuleImport] }],
  },
}

/**
 * Внутри модуля любой путь наружу через `../` ведёт к соседу: файлы модуля лежат
 * плоско (index, schema, service, events). Значит `../platform/service` — это тот же
 * обход границы, только записанный иначе, и запрещать его надо отдельно:
 * алиасный паттерн его не ловит.
 *
 * Правила не сливаются, а перекрываются, поэтому межмодульный паттерн повторён.
 */
const siblingModuleEscape = {
  name: 'project/module-boundaries-relative',
  files: ['src/modules/*/*.ts', 'src/modules/*/*.tsx'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        crossModuleImport,
        {
          group: ['../*', '../*/*'],
          message:
            'До соседнего модуля добираемся по алиасу @/modules/<name>, а не относительным ' +
            'путём наружу (CLAUDE.md §4.4). Общее живёт в @/shared.',
        },
      ],
    }],
  },
}

export default tseslint.config(
  { ignores: ['.next/**', 'out/**', 'node_modules/**', 'drizzle/**', 'design/**', 'next-env.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    name: 'project/base',
    languageOptions: {
      parserOptions: {
        // Конфиги в .mjs не входят в tsconfig — разбираем их без типовой информации
        projectService: { allowDefaultProject: ['*.mjs', '*.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    name: 'project/react',
    files: ['src/app/**/*.tsx', 'src/ui/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  {
    name: 'project/scripts',
    files: ['src/db/*.ts', 'src/worker/**/*.ts', '*.config.ts', 'eslint.config.mjs'],
    rules: { 'no-console': 'off' },
  },
  moduleBoundaries,
  siblingModuleEscape,
)

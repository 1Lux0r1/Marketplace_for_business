import type { NextConfig } from 'next'

/**
 * Версия сборки: проставляется скриптом деплоя (или GitHub Actions), локально — dev.
 * Видна на странице и в /api/health — по ней понятно, что именно сейчас выложено.
 */
const buildVersion = process.env.BUILD_VERSION ?? 'dev'
const buildTime = process.env.BUILD_TIME ?? ''

/**
 * DEMO_EXPORT=1 собирает витрину как набор обычных файлов для GitHub Pages —
 * без сервера и без базы. Это временная замена боевому серверу: посмотреть
 * и показать. Настоящий деплой на VPS собирается без этого флага.
 *
 * basePath нужен, потому что Pages отдаёт сайт не с корня домена,
 * а из подпапки с именем репозитория.
 */
const isDemoExport = process.env.DEMO_EXPORT === '1'
const demoBasePath = process.env.DEMO_BASE_PATH ?? '/Marketplace_for_business'

/**
 * В демо нет сервера, а значит нет ни команд формы, ни сессии: подставляем
 * заглушки прямо на сборке. Так формы входа и регистрации живут в одном
 * экземпляре и не обрастают проверками «а мы сейчас в демо».
 *
 * Подмена именно после разрешения пути: обычный alias здесь не работает,
 * потому что `@/` разбирает свой обработчик Next, и до alias дело не доходит.
 */
const DEMO_STUBBED = /[\\/]server[\\/](auth-actions|session)$/

type WebpackConfig = { plugins: unknown[] }
type WebpackContext = {
  webpack: {
    NormalModuleReplacementPlugin: new (
      test: RegExp,
      replace: (resource: { request: string }) => void,
    ) => unknown
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: { BUILD_VERSION: buildVersion, BUILD_TIME: buildTime },
  ...(isDemoExport
    ? {
        output: 'export' as const,
        basePath: demoBasePath,
        assetPrefix: demoBasePath,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
  webpack(config: WebpackConfig, { webpack }: WebpackContext) {
    if (isDemoExport) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(DEMO_STUBBED, (resource) => {
          resource.request = `${resource.request}.demo`
        }),
      )
    }
    return config
  },
  // Телеметрия Next уезжает за пределы РФ — выключена переменной
  // NEXT_TELEMETRY_DISABLED в systemd-юните и в скрипте деплоя (§8).
}

export default nextConfig

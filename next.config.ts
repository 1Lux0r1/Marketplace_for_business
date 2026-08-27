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
  // Телеметрия Next уезжает за пределы РФ — выключена переменной
  // NEXT_TELEMETRY_DISABLED в systemd-юните и в скрипте деплоя (§8).
}

export default nextConfig

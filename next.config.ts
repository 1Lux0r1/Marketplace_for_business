import type { NextConfig } from 'next'

// Версия сборки: проставляется скриптом деплоя, локально — dev
const buildVersion = process.env.BUILD_VERSION ?? 'dev'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: { BUILD_VERSION: buildVersion },
  // Логи не должны уезжать за пределы РФ (§8): телеметрия Next выключена
  // переменной NEXT_TELEMETRY_DISABLED в systemd-юните и в деплое.
}

export default nextConfig

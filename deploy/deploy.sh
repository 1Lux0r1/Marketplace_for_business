#!/usr/bin/env bash
# Деплой: забрать код, собрать, накатить миграции, перезапустить.
# Запускается на сервере от пользователя с правом sudo systemctl.
set -Eeuo pipefail

APP_DIR=${APP_DIR:-/srv/marketplace}
BRANCH=${BRANCH:-main}

cd "$APP_DIR"

echo "→ Забираем $BRANCH"
git fetch --prune origin "$BRANCH"
git reset --hard "origin/$BRANCH"

# Версия сборки видна на странице и в /api/health — по ней понятно,
# что именно сейчас в проде, без гадания по времени файлов
BUILD_VERSION="$(git describe --tags --always --dirty)"
export BUILD_VERSION
echo "→ Версия $BUILD_VERSION"

echo "→ Зависимости"
pnpm install --frozen-lockfile --prod=false

echo "→ Сборка"
NEXT_TELEMETRY_DISABLED=1 pnpm build

echo "→ Миграции"
pnpm db:migrate

echo "→ Перезапуск"
sudo systemctl restart marketplace-app.service
sudo systemctl restart marketplace-worker.service

echo "→ Проверка живости"
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null "http://127.0.0.1:${PORT:-3000}/api/health"; then
    echo "Готово: $BUILD_VERSION"
    exit 0
  fi
  sleep 1
done

echo "Приложение не ответило на /api/health за 30 секунд" >&2
sudo systemctl status --no-pager marketplace-app.service >&2 || true
exit 1

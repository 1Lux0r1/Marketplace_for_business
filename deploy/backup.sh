#!/usr/bin/env bash
# Ежедневный дамп базы в S3-совместимое хранилище в РФ (§8).
# Крон: 0 3 * * * /srv/marketplace/deploy/backup.sh >> /var/log/marketplace/backup.log 2>&1
set -Eeuo pipefail

APP_DIR=${APP_DIR:-/srv/marketplace}
# shellcheck disable=SC1091
set -a; source "$APP_DIR/.env"; set +a

STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
FILE="/tmp/marketplace-${STAMP}.dump"

echo "→ Дамп $STAMP"
# -Fc: пользовательский формат, восстанавливается pg_restore выборочно
pg_dump --format=custom --no-owner --no-privileges --file="$FILE" "$DATABASE_URL"

SIZE="$(stat -c %s "$FILE")"
# Дамп меньше мегабайта на живой базе означает, что что-то пошло не так,
# а не что данных мало. Лучше заметить сейчас, чем при восстановлении
if [ "$SIZE" -lt 1000000 ]; then
  echo "Дамп подозрительно мал: $SIZE байт" >&2
fi

echo "→ Выгрузка в $S3_BUCKET"
aws --endpoint-url "$S3_ENDPOINT" s3 cp "$FILE" "s3://$S3_BUCKET/db/marketplace-${STAMP}.dump"

rm -f "$FILE"

echo "→ Чистка старше 30 дней"
CUTOFF="$(date -u -d '30 days ago' +%Y-%m-%d)"
aws --endpoint-url "$S3_ENDPOINT" s3 ls "s3://$S3_BUCKET/db/" \
  | awk -v cutoff="$CUTOFF" '$1 < cutoff { print $4 }' \
  | while read -r old; do
      [ -n "$old" ] && aws --endpoint-url "$S3_ENDPOINT" s3 rm "s3://$S3_BUCKET/db/$old"
    done

echo "Готово: marketplace-${STAMP}.dump ($SIZE байт)"

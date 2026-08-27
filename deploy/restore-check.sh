#!/usr/bin/env bash
# Проверка восстановления. Дамп, который не восстанавливали, — не резервная копия.
# Критерий приёмки 01-1 требует именно проверенного восстановления, а не факта дампа.
#
# Запускать вручную после настройки бэкапа и потом раз в месяц.
set -Eeuo pipefail

APP_DIR=${APP_DIR:-/srv/marketplace}
# shellcheck disable=SC1091
set -a; source "$APP_DIR/.env"; set +a

DUMP=${1:-}
if [ -z "$DUMP" ]; then
  echo "Использование: restore-check.sh <файл дампа>" >&2
  echo "Скачать последний: aws --endpoint-url \$S3_ENDPOINT s3 ls s3://\$S3_BUCKET/db/" >&2
  exit 2
fi

CHECK_DB="marketplace_restore_check_$(date -u +%s)"
ADMIN_URL="${DATABASE_URL%/*}/postgres"

cleanup() { psql "$ADMIN_URL" -qc "DROP DATABASE IF EXISTS \"$CHECK_DB\";" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "→ Пустая база $CHECK_DB"
psql "$ADMIN_URL" -qc "CREATE DATABASE \"$CHECK_DB\";"

echo "→ Восстановление из $DUMP"
pg_restore --no-owner --no-privileges --dbname="${DATABASE_URL%/*}/$CHECK_DB" "$DUMP"

echo "→ Что восстановилось"
psql "${DATABASE_URL%/*}/$CHECK_DB" -qAt -c "
  select table_schema || '.' || table_name || ' = ' ||
         (xpath('/row/c/text()',
           query_to_xml('select count(*) as c from ' || quote_ident(table_schema) || '.' || quote_ident(table_name),
           false, true, '')))[1]::text
  from information_schema.tables
  where table_schema in ('platform','catalog','intake','matching','deal','documents','payments','notifications','analytics')
  order by 1;"

echo "Восстановление прошло. Проверьте, что числа выше похожи на правду."

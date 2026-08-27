# Деплой

Три процесса на одном VPS в России, под systemd (`docs/01-architecture.md`).
Персональные данные россиян — только на серверах в РФ (§8 `CLAUDE.md`), это
касается базы, логов, почтового шлюза и хранилища дампов.

## Первая установка

```bash
sudo useradd --system --home /srv/marketplace --shell /usr/sbin/nologin app
sudo mkdir -p /srv/marketplace /var/log/marketplace
sudo chown app:app /srv/marketplace /var/log/marketplace

sudo -u app git clone <репозиторий> /srv/marketplace
sudo -u app cp /srv/marketplace/.env.example /srv/marketplace/.env
sudo -u app "$EDITOR" /srv/marketplace/.env     # заполнить, иначе приложение не стартует

sudo cp /srv/marketplace/deploy/app.service    /etc/systemd/system/marketplace-app.service
sudo cp /srv/marketplace/deploy/worker.service /etc/systemd/system/marketplace-worker.service
sudo systemctl daemon-reload
sudo systemctl enable --now marketplace-app marketplace-worker
```

## Обновление

```bash
sudo -u app /srv/marketplace/deploy/deploy.sh
```

Скрипт забирает ветку, ставит зависимости, собирает, накатывает миграции,
перезапускает оба юнита и ждёт ответа `/api/health`. Не дождался за 30 секунд —
выходит с ошибкой и печатает статус юнита.

## Резервные копии

```
0 3 * * * /srv/marketplace/deploy/backup.sh >> /var/log/marketplace/backup.log 2>&1
```

`backup.sh` кладёт `pg_dump -Fc` в S3-совместимое хранилище в РФ и чистит копии
старше 30 дней.

**Дамп, который не восстанавливали, — не резервная копия.** После настройки
и дальше раз в месяц:

```bash
aws --endpoint-url "$S3_ENDPOINT" s3 cp s3://$S3_BUCKET/db/<последний>.dump /tmp/
/srv/marketplace/deploy/restore-check.sh /tmp/<последний>.dump
```

Скрипт поднимает временную базу, восстанавливает в неё дамп, печатает количество
строк по таблицам и удаляет базу за собой.

## Ротация логов

`/etc/logrotate.d/marketplace`:

```
/var/log/marketplace/*.log {
    daily
    rotate 14
    compress
    missingok
    notifempty
    copytruncate
}
```

Ротация системная, а не пакетом внутри приложения (§3: лишняя зависимость).

## Чего здесь нет

Скрипты **не проверены на живом сервере** — сервера пока нет (Q7
в `docs/06-open-questions.md`). Проверять по порядку: юниты, потом `deploy.sh`,
потом `backup.sh`, и только потом считать критерий приёмки 01-1 закрытым.

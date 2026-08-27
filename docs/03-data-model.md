# Модель данных — первый спринт

Только схемы `platform`, `catalog`, `intake`. Остальные добавляются своими спринтами.

Общие правила: `id` — UUID v7, генерируется в коде. Все временные метки — `timestamptz`
в UTC. Все суммы — `bigint` в копейках. Между схемами внешних ключей нет.

## schema `platform`

```sql
create schema platform;

-- Организация: и клиент, и подрядчик — это org с разным kind
create table platform.orgs (
  id            uuid primary key,
  kind          text not null check (kind in ('client','contractor')),
  name          text not null,
  inn           text,
  kpp           text,
  legal_address text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
create index on platform.orgs (kind, is_active);
create unique index on platform.orgs (inn) where inn is not null;

create table platform.users (
  id            uuid primary key,
  org_id        uuid not null references platform.orgs(id),
  email         text not null,
  phone         text,
  full_name     text not null,
  role          text not null check (role in ('owner','staff','operator','admin')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);
create unique index on platform.users (lower(email));

-- Вход по ссылке на почту: пароля в системе нет
create table platform.login_tokens (
  id          uuid primary key,
  email       text not null,
  token_hash  text not null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index on platform.login_tokens (token_hash);

create table platform.sessions (
  id          uuid primary key,
  user_id     uuid not null references platform.users(id),
  token_hash  text not null,
  expires_at  timestamptz not null,
  ip          inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index on platform.sessions (token_hash);
create index on platform.sessions (user_id);

-- Журнал событий: сердце системы
create table platform.outbox (
  id            bigserial primary key,
  type          text not null,
  aggregate     text not null,
  aggregate_id  uuid not null,
  payload       jsonb not null,
  occurred_at   timestamptz not null default now(),
  processed_at  timestamptz,
  attempts      int not null default 0,
  last_error    text
);
create index on platform.outbox (processed_at, id) where processed_at is null;
create index on platform.outbox (aggregate, aggregate_id);
create index on platform.outbox (type, occurred_at);
```

Про `outbox`: `bigserial`, а не UUID — порядок обработки должен совпадать с порядком
записи. Частичный индекс по `processed_at is null` держит выборку воркера быстрой
даже когда в таблице миллионы обработанных строк.

## schema `catalog`

```sql
create schema catalog;

create table catalog.categories (
  id         uuid primary key,
  code       text not null unique,          -- 'sanitation', 'cleaning', 'hvac'
  parent_id  uuid references catalog.categories(id),
  name       text not null,
  kind       text not null check (kind in ('service','goods')),
  is_active  boolean not null default true,
  sort_order int not null default 100
);

create table catalog.contractors (
  id            uuid primary key,
  org_id        uuid not null,              -- platform.orgs, без FK: другая схема
  status        text not null check (status in ('draft','active','paused','blocked')),
  manual_rating int check (manual_rating between 1 and 5),
  notes         text,
  created_at    timestamptz not null default now()
);
create index on catalog.contractors (status);
create unique index on catalog.contractors (org_id);

create table catalog.contractor_categories (
  contractor_id uuid not null references catalog.contractors(id) on delete cascade,
  category_id   uuid not null references catalog.categories(id),
  primary key (contractor_id, category_id)
);

create table catalog.coverage_zones (
  id            uuid primary key,
  contractor_id uuid not null references catalog.contractors(id) on delete cascade,
  kind          text not null check (kind in ('district','city')),
  code          text not null,              -- 'msk-cao', 'msk-sao'
  name          text not null
);
create index on catalog.coverage_zones (code);
```

Обрати внимание: `contractors.org_id` ссылается на `platform.orgs`, но **внешнего ключа
нет** — это межмодульная граница. Целостность проверяет код `catalog`, вызывая
`platform.getOrg()`. Внутри схемы `catalog` внешние ключи, наоборот, обязательны.

## schema `intake`

```sql
create schema intake;

create table intake.requests (
  id             uuid primary key,
  client_org_id  uuid not null,             -- platform.orgs, без FK
  created_by     uuid,                      -- platform.users, без FK; null для бота
  source         text not null check (source in ('web','telegram','operator')),
  raw_text       text,                      -- что написал клиент своими словами
  category_id    uuid,                      -- catalog.categories, без FK
  urgency        text not null default 'normal'
                 check (urgency in ('normal','urgent','planned')),
  address        text,
  zone_code      text,
  contact_name   text,
  contact_phone  text,
  desired_at     timestamptz,
  status         text not null default 'new'
                 check (status in ('new','parsed','converted','rejected')),
  parse_source   text check (parse_source in ('ai','rules','operator')),
  parse_meta     jsonb,                     -- уверенность модели, версия, время
  created_at     timestamptz not null default now()
);
create index on intake.requests (status, created_at);
create index on intake.requests (client_org_id, created_at desc);

create table intake.request_events (
  id          bigserial primary key,
  request_id  uuid not null references intake.requests(id) on delete cascade,
  type        text not null,
  payload     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index on intake.request_events (request_id, id);
```

`parse_source` и `parse_meta` заполняются всегда — по ним потом считается,
насколько модель лучше правил. Это цифра для отчёта по гранту, и собирать её
надо с первой заявки, а не когда понадобится.

## Демо-данные

`pnpm db:seed` создаёт: 2 организации-клиента, 6 подрядчиков в 4 категориях
с зонами по округам Москвы, 12 категорий первой волны, 1 пользователя-оператора.
Только для разработки и демо-режима — **отдельная база, не смешивать с рабочей.**

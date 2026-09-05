# Модель данных — первый спринт

Только схемы `platform`, `catalog`, `intake`. Остальные добавляются своими спринтами.

DDL `catalog.listings` и `catalog.listing_zones` добавлен после корректировки
продуктовой модели: каталог — основной путь клиента (`CLAUDE.md` §1).
Открытые места вокруг него — Q8 и Q10 в `docs/06-open-questions.md`.

Общие правила: `id` — UUID v7, генерируется в коде. Все временные метки — `timestamptz`
в UTC. Все суммы — `bigint` в копейках. Между схемами внешних ключей нет.

## schema `platform`

```sql
create schema platform;

-- Организация. Одна и та же компания может и заказывать, и выполнять —
-- ограничивать это нечем и незачем (решение от 05.09.2026)
create table platform.orgs (
  id            uuid primary key,
  legal_form    text not null check (legal_form in ('individual','sole_trader','company')),
  is_client     boolean not null default true,   -- заказывает
  is_contractor boolean not null default false,  -- выполняет
  -- Служебная организация самой площадки: в ней живут operator и admin,
  -- её реквизиты попадают в договор, счёт и акт (решение Q2). Такая ровно одна
  is_platform   boolean not null default false,
  name          text not null,
  inn           text,
  kpp           text,
  legal_address text,
  is_active     boolean not null default true,
  -- Данные справочника: название, статус, руководитель, дата ответа.
  -- Хранится ответ целиком — через полгода надо уметь ответить,
  -- на основании чего компанию пустили на площадку
  inn_verified_at   timestamptz,
  inn_verification  jsonb,
  created_at    timestamptz not null default now()
);
create index on platform.orgs (is_client, is_active) where is_client;
create index on platform.orgs (is_contractor, is_active) where is_contractor;
create unique index on platform.orgs (inn) where inn is not null;
create unique index on platform.orgs ((true)) where is_platform;

create table platform.users (
  id                uuid primary key,
  org_id            uuid not null references platform.orgs(id),
  email             text not null,
  email_verified_at timestamptz,      -- почта подтверждена кодом из письма
  -- Телефон обязателен и может быть способом входа, поэтому хранится
  -- в E.164 (+79161234567) и подтверждается отдельно
  phone             text not null,
  phone_verified_at timestamptz,
  full_name         text not null,
  -- Должность, а не права: директор, бухгалтер, менеджер. Права выдаются
  -- приглашением, а не выбором при регистрации (решение Q19.3)
  position          text,
  -- Совпало ли ФИО с руководителем в реестре. Это не удостоверение личности,
  -- а проверка «заявленное не противоречит реестру»
  position_checked_at timestamptz,
  position_check      jsonb,
  role              text not null check (role in ('owner','staff','operator','admin')),
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  last_login_at     timestamptz
);
create unique index on platform.users (lower(email));
-- Уникальность телефона — только среди подтверждённых. Иначе достаточно
-- зарегистрироваться на чужой номер, чтобы настоящий владелец не смог
create unique index on platform.users (phone) where phone_verified_at is not null;

-- Способы входа отдельной таблицей, а не колонками в users. Добавить вход
-- по телефону, через Telegram или через партнёра станет строкой нового вида,
-- а не изменением структуры пользователей и не переносом данных
create table platform.credentials (
  id           uuid primary key,
  user_id      uuid not null references platform.users(id) on delete cascade,
  kind         text not null check (kind in ('password','email_link')),
  secret_hash  text,          -- пароль: медленный хэш; для email_link пусто
  params       jsonb not null default '{}',   -- соль и параметры хэширования
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
create unique index on platform.credentials (user_id, kind) where is_active;

-- Одноразовые ссылки: и для входа, и для подтверждения почты, и для установки
-- пароля. Одна таблица с назначением вместо трёх одинаковых
create table platform.login_tokens (
  id          uuid primary key,
  email       text not null,
  purpose     text not null default 'login'
              check (purpose in ('login','verify_email','set_password','reset_password')),
  token_hash  text not null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create unique index on platform.login_tokens (token_hash);
create index on platform.login_tokens (email, purpose, created_at desc);

-- Журнал попыток входа. Нужен, чтобы ограничивать частоту и ловить подбор
-- пароля. Одна таблица обслуживает и вход по паролю, и вход по ссылке
create table platform.login_attempts (
  id         bigserial primary key,
  email      text not null,
  ip         inet,
  method     text not null check (method in ('password','email_link')),
  succeeded  boolean not null,
  at         timestamptz not null default now()
);
create index on platform.login_attempts (lower(email), at desc);
create index on platform.login_attempts (ip, at desc);

create table platform.sessions (
  id          uuid primary key,
  user_id     uuid not null references platform.users(id),
  token_hash  text not null,
  expires_at  timestamptz not null,
  ip          inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create unique index on platform.sessions (token_hash);
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

Про `orgs.inn_verification`: подрядчик регистрируется сам (решение Q10), значит
ИНН проверяется машинно, а не глазами оператора. Хранится весь ответ справочника,
а не только флаг: через полгода понадобится ответить, на основании чего компанию
пустили на площадку. Чем именно проверять — открытый вопрос Q11.

Про способы входа. Пароль и вход по ссылке — **две записи одного вида**,
а не два разных механизма: у пользователя может быть и то, и другое одновременно.
Это и есть запас на будущее: вход по телефону или через партнёра добавляется
новым значением `kind`, без переноса данных и без правки таблицы пользователей.

Пароль хранится медленным хэшем — таким, который специально считается долго,
чтобы перебор по украденной базе был неподъёмным. Ссылки, наоборот, хранятся
быстрым отпечатком: у них 32 случайных байта, перебирать нечего.

`login_attempts` — журнал попыток. По нему считается ограничение частоты:
и «не больше трёх писем на адрес за 15 минут», и «после пяти неверных паролей
подряд вход по паролю для этого адреса приостанавливается». Отдельного
хранилища для счётчиков не заводим (§3).

Про роли организации. Заказчик и подрядчик — **не взаимоисключающие**:
одна и та же компания может и заказывать, и выполнять. Поэтому вместо одного
`kind` два независимых признака. Практически это значит, что в интерфейсе
у такой компании доступны оба набора разделов, и переключаться между ними
человек должен явно, а не искать нужный раздел среди восьми.

`is_contractor` не выдаётся при регистрации автоматически: стать подрядчиком —
отдельное действие с проверкой ИНН и подписанием договора. Регистрация даёт
`is_client`; «начать выполнять работы» человек включает сам, когда готов.

Про организацию площадки. `users.org_id` остаётся `not null` — правило
«у каждого человека есть компания» выполняется без исключений. Операторы
и администраторы принадлежат организации с `is_platform`, и её же реквизиты
берёт модуль `documents`, когда выпускает договор и счёт от имени площадки.

Такая организация в системе ровно одна, и это обеспечено частичным уникальным
индексом, а не только кодом: `unique ((true)) where is_platform` физически
не даст создать вторую.

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

-- Карточка каталога: что подрядчик продаёт. Основной путь клиента —
-- выбрать карточку, а не оставить заявку
create table catalog.listings (
  id              uuid primary key,
  contractor_id   uuid not null references catalog.contractors(id) on delete cascade,
  category_id     uuid not null references catalog.categories(id),
  title           text not null,
  description     text,
  unit            text not null,                -- 'объект', 'м2', 'час', 'шт'
  price_kopecks   bigint not null check (price_kopecks > 0),
  min_qty         numeric(12,3) not null default 1,
  lead_time_hours int,                          -- через сколько подрядчик готов приступить
  status          text not null default 'draft'
                  check (status in ('draft','pending','published','rejected','archived')),
  rejection_note  text,                         -- что исправить: показывается подрядчику
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on catalog.listings (status, category_id);
create index on catalog.listings (contractor_id, status);
create index on catalog.listings (category_id, price_kopecks) where status = 'published';

-- Зоны карточки — подмножество зон подрядчика. Пусто = работают все его зоны
create table catalog.listing_zones (
  listing_id uuid not null references catalog.listings(id) on delete cascade,
  zone_code  text not null,
  primary key (listing_id, zone_code)
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

Про `listings`. `price_kopecks` — цена за одну единицу `unit`, в копейках, как везде
(`CLAUDE.md` §6). Цена в карточке — это **оферта подрядчика**, поэтому она копируется
в сделку в момент создания, а не читается из карточки по ссылке: подрядчик вправе
поменять цену завтра, а сделка вчерашняя. То же правило действует для `title`
и `unit` — сделка хранит снимок, каталог хранит текущее.

`status` карточки — это модерация, а не витрина: `draft` пишет подрядчик,
`pending` ждёт оператора, `published` видно клиентам, `rejected` возвращено
с `rejection_note`, `archived` снято подрядчиком. Частичный индекс по
`status = 'published'` держит витрину быстрой, когда снятых карточек станет больше,
чем живых.

`listing_zones.zone_code` — текст без ссылки на `coverage_zones`: одна карточка
может работать не во всех зонах подрядчика. Проверка «зона карточки входит в зоны
подрядчика» делается кодом при публикации, а не базой.

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

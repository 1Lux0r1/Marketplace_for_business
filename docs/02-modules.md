# Модули: ответственность и контракты

## Сводка

| Модуль | Отвечает за | Владеет схемой | Зависит от | Часы |
|---|---|---|---|---|
| `platform` | Организации, пользователи, сессии, роли, outbox | `platform` | — | 26 |
| `catalog` | Категории, подрядчики, компетенции, зоны | `catalog` | platform | 20 |
| `intake` | Приём заявки: форма, Telegram, нормализация | `intake` | platform, ai | 18 |
| `matching` | Кандидаты, рассылка предложений, отклики | `matching` | catalog, ai | 26 |
| `deal` | Сделка: статусы, цена, сроки, переписка, приёмка | `deal` | intake, matching, catalog | 28 |
| `documents` | Договор, счёт, акт: шаблоны, PDF, нумерация | `documents` | deal | 24 |
| `payments` | Ссылки, вебхуки, комиссия, реестр выплат | `payments` | deal | 16 |
| `notifications` | Почта, Telegram, шаблоны, ретраи | `notifications` | слушает события | 14 |
| `analytics` | Журнал событий, метрики, когорты | `analytics` | слушает события | 8 |

Интерфейсы (`client-web` 16, `contractor-web` 18, `admin` 10), демо-режим (12)
и тесты (16) собственных схем не имеют.

**Итого урезанная конфигурация: 298 часов.**

## Форма контракта модуля

Каждый `index.ts` экспортирует три вещи и ничего больше:

```ts
// 1. Команды — меняют состояние, возвращают минимум
export async function acceptOffer(input: {
  dealId: string
  offerId: string
  actorId: string
}): Promise<{ dealId: string }>

// 2. Запросы — только читают, возвращают готовый к показу объект
export async function getDealSummary(dealId: string): Promise<DealSummary>

// 3. Типы событий, которые модуль публикует
export type DealAccepted = {
  type: 'deal.accepted'
  dealId: string
  contractorId: string      // идентификатор, НЕ ссылка на catalog
  priceKopecks: bigint
  scheduledAt: string       // ISO 8601, UTC
}
```

Правила формы:

- Команда принимает один объект, а не позиционные аргументы.
- В каждой команде есть `actorId` — кто её выполняет. Проверка прав внутри команды.
- Запрос возвращает данные, готовые к отображению; собирать их в компоненте нельзя.
- В событии — идентификаторы и значения, никогда объекты чужих модулей.

## События системы

| Событие | Публикует | Слушают |
|---|---|---|
| `request.created` | intake | matching, analytics |
| `request.parsed` | intake | analytics |
| `offers.collected` | matching | deal, notifications, analytics |
| `deal.quoted` | deal | notifications, analytics |
| `deal.accepted` | deal | documents, notifications, analytics |
| `act.issued` | documents | payments, notifications, analytics |
| `payment.captured` | payments | deal, notifications, analytics |
| `deal.completed` | deal | payments, notifications, analytics |
| `deal.disputed` | deal | notifications, analytics |
| `deal.cancelled` | deal | notifications, analytics |

## Статусы сделки

```
new ──▶ matching ──▶ quoted ──▶ accepted ──▶ in_progress ──▶ paid ──▶ completed
         │             │           │              │
         └─────────────┴───────────┴──────────────┴──────▶ cancelled
                                                  │
                                                  └──────▶ disputed ──▶ completed
```

| Статус | Означает | Кто переводит дальше |
|---|---|---|
| `new` | Заявка принята и разобрана, кандидаты не отобраны | matching, автоматически |
| `matching` | Предложения разосланы, идёт сбор откликов | подрядчики или таймер 2 ч |
| `quoted` | Клиенту показаны три варианта с ценой и сроком | клиент |
| `accepted` | Вариант выбран, цена и срок зафиксированы | documents, автоматически |
| `in_progress` | Договор и счёт выставлены, подрядчик работает | подрядчик |
| `paid` | Оплата подтверждена вебхуком | payments, автоматически |
| `completed` | Акт подписан, комиссия начислена, выплата в реестре | — |
| `disputed` | Клиент заявил рекламацию, ручной разбор | оператор |
| `cancelled` | Отменена до начала работ | — |

Переходы, которых нет в схеме выше, запрещены и должны падать с понятной ошибкой.
Это первое, что покрывается тестами.

## Запасные пути ai-service

| Метод | Что делает | Если недоступен |
|---|---|---|
| `POST /parse` | Свободный текст → категория, срочность, объём, требования | Форма с ручным выбором категории |
| `POST /score` | Заявка + кандидаты → упорядоченный список | Сортировка по правилам: зона, категория, свободен |
| `POST /risk` | Подрядчик + задача → риск срыва 0..1 | Риск нулевой, сделка идёт |
| `POST /price` | Категория + объём + зона → вилка цены | Вилка не показывается |

**Порядок работ: сначала правила, потом модель поверх них.** Правила — не заглушка,
а постоянный запасной путь и способ измерить, насколько модель лучше. Эта разница
пойдёт в отчёт по гранту и в питч.

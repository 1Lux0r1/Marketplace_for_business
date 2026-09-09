'use client'

import { useState } from 'react'
import {
  Button,
  Chip,
  Field,
  FilterBar,
  ListFrame,
  ListRow,
  Modal,
  MoneyField,
  PageBody,
  PageHeader,
  Pager,
  Select,
  StatusBadge,
  Tabs,
  TagPicker,
  Textarea,
} from '@/ui'
import { formatKopecks } from '@/shared/money'

/**
 * Витрина дизайн-системы: все примитивы на одном экране, живые.
 *
 * Нужна не для красоты. Компонент проверяется не по коду, а глазами и с
 * клавиатуры: видно ли фокус, читается ли ошибка, попадает ли палец. Экран,
 * где всё лежит рядом, находит расхождения раньше, чем они расползутся
 * по настоящим экранам.
 *
 * Данные вымышленные и служат только для оценки вёрстки.
 */
export default function UiKit() {
  const [price, setPrice] = useState<bigint | null>(540_000n)
  const [zones, setZones] = useState(['cao', 'sao'])
  const [category, setCategory] = useState('sanitary')
  const [urgency, setUrgency] = useState('day')
  const [confirming, setConfirming] = useState(false)

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { href: '/', label: 'Найти услугу' },
          { href: '/ui-kit', label: 'Дизайн-система' },
        ]}
        title="Примитивы рабочих экранов"
        description="Из этого собираются кабинет подрядчика, экраны оператора и кабинет клиента. Данные вымышленные."
        action={<Button>Главное действие</Button>}
        secondary={<Button variant="ghost">Второстепенное</Button>}
      />

      <PageBody>
        <section className="flex flex-col gap-3.5">
          <h2 className="text-section font-bold">Поля формы</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Название услуги" defaultValue="Дезинсекция помещений общепита" />
            <Select
              label="Категория"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={[
                { value: 'sanitary', label: 'Санобработка' },
                { value: 'cleaning', label: 'Клининг' },
                { value: 'hvac', label: 'Вентиляция и электрика' },
              ]}
              hint="Категории задаёт площадка, руками их не вводят"
            />
            <MoneyField
              label="Цена за объект"
              valueKopecks={price}
              onChange={setPrice}
              hint={price === null ? 'Без цены карточку не опубликовать' : `В каталоге: ${formatKopecks(price)}`}
            />
            <Select
              label="Срок выезда"
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
              options={[
                { value: 'day', label: 'За 24 часа' },
                { value: 'week', label: 'В течение недели' },
              ]}
            />
            <div className="md:col-span-2">
              <Textarea
                label="Что входит в услугу"
                defaultValue="Осмотр помещения, обработка кухни, склада и зала, акт обработки для проверки Роспотребнадзора."
                hint="Клиент читает это перед заказом — пишите то, что важно ему, а не вам"
              />
            </div>
            <Field
              label="Площадь объекта"
              defaultValue="абв"
              error="Впишите площадь цифрами, например 120"
            />
            <div className="md:col-span-2">
              <TagPicker
                legend="Зоны выезда"
                name="zones"
                selected={zones}
                onChange={setZones}
                options={[
                  { value: 'cao', label: 'ЦАО' },
                  { value: 'sao', label: 'САО' },
                  { value: 'svao', label: 'СВАО' },
                  { value: 'vao', label: 'ВАО' },
                  { value: 'uao', label: 'ЮАО' },
                ]}
                hint="Карточка покажется только в выбранных зонах"
              />
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3.5">
          <h2 className="text-section font-bold">Список с фильтрами</h2>
          <Tabs
            tabs={[
              { value: 'published', label: 'Опубликованные', count: 12 },
              { value: 'pending', label: 'На модерации', count: 3 },
              { value: 'draft', label: 'Черновики' },
              { value: 'archived', label: 'Снятые' },
            ]}
            current="pending"
          />
          <FilterBar resultLabel="Показано 3 из 138" onReset={() => undefined}>
            <Chip selected>Санобработка</Chip>
            <Chip>Клининг</Chip>
            <Chip selected count={2}>ЦАО</Chip>
            <Chip>Выезд за 24 часа</Chip>
          </FilterBar>

          <ListFrame>
            <ListRow
              title="Дезинсекция помещений общепита"
              meta="Санобработка · ЦАО, САО · за объект до 100 м²"
              status={<StatusBadge tone="warn">На модерации</StatusBadge>}
              amount={formatKopecks(450_000n)}
              actions={
                <>
                  <Button size="sm" variant="ghost">Изменить</Button>
                  <Button size="sm" variant="quiet" onClick={() => setConfirming(true)}>Снять</Button>
                </>
              }
            />
            <ListRow
              title="Генеральная уборка после ремонта"
              meta="Клининг · ЦАО · за помещение"
              status={<StatusBadge tone="ok">Опубликована</StatusBadge>}
              amount={formatKopecks(1_428_000n)}
              actions={
                <>
                  <Button size="sm" variant="ghost">Изменить</Button>
                  <Button size="sm" variant="quiet">Снять</Button>
                </>
              }
            />
            <ListRow
              title="Плановая чистка вытяжки"
              meta="Вентиляция · СВАО · за смену"
              status={<StatusBadge tone="err">Отклонена</StatusBadge>}
              amount={formatKopecks(980_000n)}
              actions={<Button size="sm" variant="ghost">Исправить</Button>}
            />
          </ListFrame>

          <Pager page={2} perPage={3} total={138} />
        </section>
      </PageBody>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Снять карточку с публикации?"
        description="Клиенты перестанут её видеть в каталоге. Заказы, которые уже оформлены по этой карточке, продолжат идти как обычно."
        confirmLabel="Снять с публикации"
        onConfirm={() => setConfirming(false)}
        danger
      />
    </>
  )
}

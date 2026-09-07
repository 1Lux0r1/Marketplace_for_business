'use client'

import { useState } from 'react'
import { EmptyState, StatusBadge, TableFrame, Td, Th, cx } from '@/ui'
import type { CompanyCard, PersonRow, SiteRow } from '@/server/company-queries'
import type { Zone } from '@/modules/catalog'
import { CompanyForm } from './company-form'
import { InviteForm } from './invite-form'
import { SiteForm } from './site-form'
import { ArchiveButton } from './archive-button'

/**
 * ЭТО ФАЙЛ ОФОРМЛЕНИЯ КАБИНЕТА. Здесь только вид, ни одного запроса к данным.
 *
 * Разделение сделано намеренно: над проектом работают двое (§12), и правки
 * оформления не должны сталкиваться с правками логики в одном файле.
 *
 * Что оформление обязано сохранить, меняя всё остальное:
 *
 * - зона точки показывается словом, а не кодом: «Центральный», не «msk-cao»;
 * - у пустого списка точек остаётся кнопка «Добавить точку» (§7.4);
 * - «ждёт первого входа» видно у приглашённого, иначе непонятно, почему
 *   человек в списке есть, а работать не начал;
 * - таблицы — внутри `TableFrame`: он даёт горизонтальную прокрутку (§7.5).
 */

type Tab = 'sites' | 'company' | 'people'

export function CompanyCabinet({
  company,
  sites,
  people,
  zones,
  canEdit,
}: {
  company: CompanyCard
  sites: SiteRow[]
  people: PersonRow[]
  zones: Zone[]
  canEdit: boolean
}) {
  const [tab, setTab] = useState<Tab>('sites')
  const active = sites.filter((site) => !site.archived)

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="text-page font-extrabold">{company.name}</h1>
        <p className="max-w-[70ch] text-body text-ink-2">
          Здесь ваши точки, реквизиты и те, кто работает с площадкой от вашего имени.
        </p>
      </header>

      <div role="tablist" aria-label="Разделы кабинета" className="flex flex-wrap gap-2">
        <TabButton current={tab} value="sites" onSelect={setTab}>
          Точки{active.length > 0 && ` · ${active.length}`}
        </TabButton>
        <TabButton current={tab} value="company" onSelect={setTab}>
          Реквизиты
        </TabButton>
        <TabButton current={tab} value="people" onSelect={setTab}>
          Доступ{people.length > 0 && ` · ${people.length}`}
        </TabButton>
      </div>

      {tab === 'sites' && <Sites sites={sites} zones={zones} />}
      {tab === 'company' && <Company company={company} canEdit={canEdit} />}
      {tab === 'people' && <People people={people} canEdit={canEdit} />}
    </>
  )
}

function TabButton({
  current,
  value,
  onSelect,
  children,
}: {
  current: Tab
  value: Tab
  onSelect: (tab: Tab) => void
  children: React.ReactNode
}) {
  const selected = current === value
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={() => onSelect(value)}
      className={cx(
        'inline-flex min-h-11 items-center rounded-pill border px-4 text-table font-semibold',
        selected
          ? 'border-accent bg-accent-tint text-accent-strong'
          : 'border-line-strong text-ink-2 hover:bg-surface-2',
      )}
    >
      {children}
    </button>
  )
}

// ─── Точки ──────────────────────────────────────────────────────────────

function Sites({ sites, zones }: { sites: SiteRow[]; zones: Zone[] }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<SiteRow | null>(null)
  const active = sites.filter((site) => !site.archived)
  const archived = sites.filter((site) => site.archived)

  if (active.length === 0 && archived.length === 0) {
    return (
      <>
        <EmptyState
          title="Точек пока нет"
          description="Точка — это адрес, куда приедет подрядчик: кафе, салон, склад. Заказ всегда оформляется на точку, поэтому заведите хотя бы одну."
          action={
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex h-11 items-center rounded-control bg-accent px-[18px] text-body font-semibold text-on-accent"
            >
              Добавить точку
            </button>
          }
        />
        {adding && <SiteForm zones={zones} onClose={() => setAdding(false)} />}
      </>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-section font-extrabold">Точки</h2>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex h-11 items-center rounded-control bg-accent px-[18px] text-body font-semibold text-on-accent"
        >
          Добавить точку
        </button>
      </div>

      <TableFrame>
        <thead>
          <tr>
            <Th>Точка</Th>
            <Th>Где</Th>
            <Th>Кому звонить</Th>
            <Th>Действия</Th>
          </tr>
        </thead>
        <tbody>
          {[...active, ...archived].map((site) => (
            <tr key={site.id} className={cx(site.archived && 'opacity-60')}>
              <Td>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{site.name}</span>
                  {site.archived && <StatusBadge tone="neutral">убрана</StatusBadge>}
                </div>
                {site.note && <div className="text-caption text-ink-3">{site.note}</div>}
              </Td>
              <Td>
                <div>{site.address}</div>
                <div className="text-caption text-ink-3">{site.zoneName}</div>
              </Td>
              <Td>
                {site.contactName ?? '—'}
                {site.contactPhone && (
                  <div className="num text-caption text-ink-3">{site.contactPhone}</div>
                )}
              </Td>
              <Td>
                <div className="flex flex-wrap gap-2">
                  {!site.archived && (
                    <button
                      type="button"
                      onClick={() => setEditing(site)}
                      className="inline-flex min-h-11 items-center rounded-control border border-line-strong px-3 text-table font-semibold text-ink-2 hover:bg-surface-2"
                    >
                      Изменить
                    </button>
                  )}
                  <ArchiveButton siteId={site.id} archived={site.archived} name={site.name} />
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableFrame>

      {adding && <SiteForm zones={zones} onClose={() => setAdding(false)} />}
      {editing && <SiteForm zones={zones} site={editing} onClose={() => setEditing(null)} />}
    </section>
  )
}

// ─── Реквизиты ──────────────────────────────────────────────────────────

function Company({ company, canEdit }: { company: CompanyCard; canEdit: boolean }) {
  const [editing, setEditing] = useState(false)

  const rows: Array<[string, React.ReactNode]> = [
    ['Название', company.name],
    ['ИНН', company.inn ? <span className="num">{company.inn}</span> : '—'],
    ['КПП', company.kpp ? <span className="num">{company.kpp}</span> : '—'],
    ['Адрес', company.legalAddress ?? '—'],
  ]

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-section font-extrabold">Реквизиты</h2>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-11 items-center rounded-control border border-line-strong px-4 text-body font-semibold text-ink-2 hover:bg-surface-2"
          >
            Изменить
          </button>
        )}
      </div>

      <dl className="flex max-w-[70ch] flex-col gap-3 rounded-card border border-line bg-surface p-5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <dt className="min-w-[10ch] text-caption font-semibold text-ink-3">{label}</dt>
            <dd className="text-body text-ink">{value}</dd>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {company.innVerified ? (
            <StatusBadge tone="ok">ИНН проверен</StatusBadge>
          ) : (
            <StatusBadge tone="warn">ИНН проверяем</StatusBadge>
          )}
        </div>
      </dl>

      <p className="max-w-[70ch] text-caption text-ink-3">
        ИНН и форму собственности через эту форму не меняют: по ним компанию опознают
        и на них выписывают документы. Если в ИНН ошибка — напишите нам, поправим вместе.
      </p>

      {editing && <CompanyForm company={company} onClose={() => setEditing(false)} />}
    </section>
  )
}

// ─── Доступ ─────────────────────────────────────────────────────────────

function People({ people, canEdit }: { people: PersonRow[]; canEdit: boolean }) {
  const [inviting, setInviting] = useState(false)

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-section font-extrabold">Кто работает от вашего имени</h2>
        {canEdit && (
          <button
            type="button"
            onClick={() => setInviting(true)}
            className="inline-flex h-11 items-center rounded-control bg-accent px-[18px] text-body font-semibold text-on-accent"
          >
            Пригласить
          </button>
        )}
      </div>

      <TableFrame>
        <thead>
          <tr>
            <Th>Человек</Th>
            <Th>Связь</Th>
            <Th>Права</Th>
          </tr>
        </thead>
        <tbody>
          {people.map((person) => (
            <tr key={person.id}>
              <Td>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{person.fullName}</span>
                  {person.isYou && <StatusBadge tone="neutral">это вы</StatusBadge>}
                  {person.waitingForFirstLogin && (
                    <StatusBadge tone="warn">ждёт первого входа</StatusBadge>
                  )}
                </div>
                {person.position && (
                  <div className="text-caption text-ink-3">{person.position}</div>
                )}
              </Td>
              <Td>
                <div>{person.email}</div>
                <div className="num text-caption text-ink-3">{person.phone}</div>
              </Td>
              <Td>{person.role === 'owner' ? 'Полный доступ' : 'Работа с заказами'}</Td>
            </tr>
          ))}
        </tbody>
      </TableFrame>

      {inviting && <InviteForm onClose={() => setInviting(false)} />}
    </section>
  )
}

// ─── Состояния ──────────────────────────────────────────────────────────

export function NeedLogin() {
  return (
    <EmptyState
      title="Нужно войти"
      description="Кабинет открывается после входа — кнопка «Войти» в правом верхнем углу."
    />
  )
}

export function DemoWithoutDatabase() {
  return (
    <EmptyState
      title="Это демо без базы данных"
      description="Здесь видно, как устроены экраны, но своей компании и точек нет: кабинет читает их из базы, а в демо её не бывает. На рабочей установке этот раздел показывает вашу компанию."
    />
  )
}

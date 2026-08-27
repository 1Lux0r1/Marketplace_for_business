import { Button, StatusBadge, PromoTag, TableFrame, Th, Td, EmptyState } from '@/ui'
import { ShieldIcon, BagIcon } from '@/ui/icons'
import { formatKopecks, commissionKopecks, payoutKopecks } from '@/shared/money'

/**
 * Временная страница каркаса: отдаёт версию сборки и показывает, что токены
 * и примитивы живые. Заменяется в 01-2 на настоящую главную, которая
 * отвечает на вопрос «что мне делать сейчас» (§7.1).
 */
export default function Home() {
  const version = process.env.BUILD_VERSION ?? 'dev'
  const priceKopecks = 540_000n
  const rate = 0.13

  return (
    <>
      <div>
        <h1 className="text-page font-extrabold tracking-tight">Каркас поднят</h1>
        <p className="mt-2 max-w-[66ch] text-body text-ink-2">
          Задача 01-1 из <code>docs/05-sprint-01.md</code>. Настоящие экраны появляются
          с 01-2: вход по ссылке на почту, организации и пользователи.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge tone="ok">Сборка {version}</StatusBadge>
        <StatusBadge tone="neutral">Схема platform создана</StatusBadge>
        <StatusBadge tone="warn">Таблиц пока нет</StatusBadge>
      </div>

      <section className="flex flex-col gap-3.5">
        <h2 className="text-section font-bold">Расчёт денег</h2>
        <p className="max-w-[66ch] text-body text-ink-2">
          Суммы — <code>bigint</code> в копейках, доля комиссии хранится как {rate},
          а не как 13. Деньги уходят подрядчику только после подписанного акта (§8).
        </p>
        <TableFrame minWidth="min-w-[520px]">
          <thead>
            <tr>
              <Th>Что</Th>
              <Th numeric>Сумма</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td>Цена работы</Td>
              <Td numeric>{formatKopecks(priceKopecks)}</Td>
            </tr>
            <tr>
              <Td>Комиссия площадки</Td>
              <Td numeric>{formatKopecks(commissionKopecks(priceKopecks, rate))}</Td>
            </tr>
            <tr>
              <Td>Выплата подрядчику</Td>
              <Td numeric>{formatKopecks(payoutKopecks(priceKopecks, rate))}</Td>
            </tr>
          </tbody>
        </TableFrame>
      </section>

      <section className="flex flex-col gap-3.5">
        <h2 className="text-section font-bold">Роли цвета</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Главное действие</Button>
          <Button variant="ghost">Второстепенное</Button>
          <Button variant="danger">Заявить рекламацию</Button>
          <PromoTag>−15 % до 31 августа</PromoTag>
        </div>
        <p className="max-w-[66ch] text-body text-ink-2">
          Бирюза — действие, оранжевый — только выгода и всегда со словом,
          <span className="text-err-strong"> #d84a2c</span> — только проблема (§7.2).
        </p>
      </section>

      <section className="flex flex-col gap-3.5">
        <h2 className="text-section font-bold">Пустое состояние</h2>
        <EmptyState
          icon={<BagIcon size={40} />}
          title="Здесь будут ваши заказы"
          description="Когда вы закажете услугу из каталога, заказ появится тут: статус работы, документы и кнопка приёмки. Деньги по каждому заказу удерживаются до подписания акта."
          action={<Button>Найти услугу</Button>}
        />
      </section>

      <p className="flex items-center gap-2 text-caption text-ink-3">
        <ShieldIcon size={15} />
        Деньги клиента лежат у площадки до подписания акта
      </p>
    </>
  )
}

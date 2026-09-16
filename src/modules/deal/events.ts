/**
 * События, которые публикует `deal`. Кто подписан — не его дело (§4.5).
 *
 * Персональных данных в полезной нагрузке нет: очередь хранит её открытым
 * текстом, а подписчикам нужны идентификаторы и суммы.
 */
export type DealEventType =
  | 'deal.created'
  | 'deal.accepted'
  | 'deal.paid'
  | 'deal.act_issued'
  | 'deal.completed'
  | 'deal.disputed'
  | 'deal.cancelled'

/**
 * `deal.completed` — единственное событие, после которого модуль выплат
 * вправе начать выплату. `payout.released` публикуется только после него,
 * никогда раньше (`docs/02-modules.md`).
 */
export type DealEventPayload = {
  dealId: string
  number: number
  status: string
  clientOrgId: string
  contractorId: string | null
  priceKopecks: string | null
}

import { beforeEach, describe, expect, it } from 'vitest'
import type { OutboxEvent } from '@/modules/platform'
import { dispatch, on, resetRegistry, subscribedTypes } from './registry'

/**
 * Раздача событий подписчикам. Проверяется поведение в плохих случаях:
 * подписчик упал, событие пришло дважды, слушателей нет вовсе.
 */

beforeEach(() => {
  resetRegistry()
})

const event: OutboxEvent = {
  id: 1,
  type: 'deal.accepted',
  aggregate: 'deal',
  aggregateId: '01a07261-0000-7000-8000-000000000001',
  payload: { dealId: '01a07261-0000-7000-8000-000000000001' },
  attempts: 1,
  occurredAt: new Date(),
}

describe('раздача событий', () => {
  it('вызывает всех подписчиков события', async () => {
    const called: string[] = []
    on('deal.accepted', async () => { called.push('письмо') })
    on('deal.accepted', async () => { called.push('метрика') })

    expect(await dispatch(event)).toEqual({ ok: true })
    expect(called.sort()).toEqual(['метрика', 'письмо'])
  })

  it('событие без подписчиков считается обработанным', async () => {
    // Иначе очередь копила бы события, которые никто не ждёт
    expect(await dispatch(event)).toEqual({ ok: true })
  })

  it('упавший подписчик не отменяет остальных', async () => {
    const called: string[] = []
    on('deal.accepted', () => Promise.reject(new Error('почта не ответила')))
    on('deal.accepted', async () => { called.push('метрика') })

    const result = await dispatch(event)
    // Письмо не ушло — это не повод не записать метрику
    expect(called).toEqual(['метрика'])
    expect(result).toEqual({ ok: false, error: 'почта не ответила' })
  })

  it('называет все причины, а не только первую', async () => {
    on('deal.accepted', () => Promise.reject(new Error('почта не ответила')))
    on('deal.accepted', () => Promise.reject(new Error('метрика не записалась')))

    const result = await dispatch(event)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('почта не ответила')
      expect(result.error).toContain('метрика не записалась')
    }
  })

  it('повторная доставка не создаёт второго эффекта, если подписчик идемпотентен', async () => {
    // Так выглядит правильный подписчик: перед делом проверяет, не сделано ли уже
    const sent = new Set<string>()
    on('deal.accepted', async (incoming) => {
      const key = `${incoming.type}:${incoming.aggregateId}`
      if (sent.has(key)) return
      sent.add(key)
    })

    await dispatch(event)
    await dispatch({ ...event, attempts: 2 })

    // Доставка «хотя бы один раз»: воркер может успеть сделать дело
    // и не успеть отметить событие — второе письмо человек не простит
    expect(sent.size).toBe(1)
  })

  it('чужие события не трогает', async () => {
    let calls = 0
    on('deal.accepted', async () => { calls += 1 })
    await dispatch({ ...event, type: 'payment.received' })
    expect(calls).toBe(0)
  })

  it('перечисляет, что слушает — это видно в логе при старте', () => {
    on('payment.received', async () => {})
    on('deal.accepted', async () => {})
    expect(subscribedTypes()).toEqual(['deal.accepted', 'payment.received'])
  })
})

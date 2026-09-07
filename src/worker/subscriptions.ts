import { childLogger } from '@/shared/logger'
import * as catalog from '@/modules/catalog'
import * as platform from '@/modules/platform'
import { lookupInn, namesMatch } from '@/shared/inn-directory'
import { on } from './registry'

/**
 * Кто на какие события подписан. Единственное место, где модули связываются
 * друг с другом: `catalog` не знает про справочник компаний, знает только этот файл.
 *
 * ЧЕГО ЗДЕСЬ НИКОГДА НЕ БУДЕТ — отправки кодов подтверждения и ссылок входа.
 * Событие лежит в базе, и всё, что в него положили, лежит там открытым текстом.
 * Код из письма — это вход в учётную запись; в очереди ему не место, и тест
 * «ни одного пароля и ни одной ссылки в открытом виде» на этом и держится.
 * Такие письма уходят прямо из обработчика запроса: человек в этот момент
 * всё равно стоит и ждёт кода.
 */
export function registerSubscriptions(): void {
  const log = childLogger({ proc: 'worker' })

  on('user.registered', (event) => {
    log.info({ eventId: event.id, orgId: event.payload.orgId }, 'зарегистрирована компания')
    return Promise.resolve()
  })

  /**
   * Проверка ИНН нового подрядчика.
   *
   * Живёт здесь, а не в обработчике регистрации, ровно поэтому: справочник
   * чужой, платный и иногда лежит. Человек не должен ждать его ответа, и уж
   * тем более получать отказ из-за чужой недоступности.
   *
   * Идемпотентность: событие может прийти дважды (§5). Повторный вызов
   * перезапишет ту же отметку теми же данными и активирует уже активного —
   * второго эффекта нет.
   */
  on('contractor.registered', async (event) => {
    const contractorId = String(event.payload.contractorId)
    const orgId = String(event.payload.orgId)
    const inn = String(event.payload.inn)

    // ФИО берём из модуля, а не из события: персональные данные должны
    // лежать в одном месте, а не расползаться копиями по очереди
    const owner = await platform.findOrgOwner(orgId)
    const claimedName = owner?.fullName ?? null

    const answer = await lookupInn(inn)

    // Совпадение ФИО — быстрый фильтр на входе, а не удостоверение личности.
    // Настоящее подтверждение полномочий даст подпись на первом документе
    const directorMatches =
      answer.status === 'found' && answer.director && claimedName
        ? namesMatch(claimedName, answer.director)
        : null

    const verified = answer.status === 'found' && answer.active && directorMatches !== false

    await catalog.applyInnVerdict({
      contractorId,
      verified,
      // Ответ кладётся целиком: через полгода надо уметь ответить,
      // на основании чего компанию пустили на площадку
      details: { ...answer, directorMatches },
    })

    log[verified ? 'info' : 'warn'](
      { eventId: event.id, contractorId, lookup: answer.status, directorMatches },
      verified ? 'ИНН подтверждён' : 'ИНН не подтверждён — заявка оператору',
    )
  })
}

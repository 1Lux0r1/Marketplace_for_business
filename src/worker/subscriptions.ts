import { childLogger } from '@/shared/logger'
import * as catalog from '@/modules/catalog'
import * as deal from '@/modules/deal'
import * as documents from '@/modules/documents'
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

  /**
   * Договор и счёт выпускаются, когда сделка принята.
   *
   * Здесь, а не внутри `deal`: модуль сделки не должен знать про документы
   * (§4.5), иначе он потянет за собой ещё и шаблоны с нумерацией. Он говорит
   * «сделка принята», а кто на это подписан — не его дело.
   *
   * Идемпотентность (§5): событие может прийти дважды, а два счёта с разными
   * номерами на одну сделку — это уже вопрос от бухгалтера. Поэтому сначала
   * смотрим, не выпущены ли документы по этой сделке.
   */
  on('deal.accepted', async (event) => {
    const dealId = String(event.payload.dealId)
    const already = await documents.listForDeal(dealId)
    if (already.some((doc) => doc.kind === 'invoice')) {
      log.info({ eventId: event.id, dealId }, 'счёт по сделке уже выпущен, пропускаем')
      return
    }

    const made = await deal.getDeal(OPERATOR, dealId)
    await issueFor(made, ['contract', 'invoice'])
    log.info({ eventId: event.id, dealId }, 'выпущены договор и счёт')
  })

  /**
   * Акт выпускается, когда подрядчик сказал, что работа готова.
   *
   * ПОДПИСАННЫЙ акт — условие выплаты (§8), и этот обработчик выпускает
   * только сам акт. Подписывает его клиент, и отметку ставит либо система
   * по ответу оператора ЭДО, либо наш сотрудник, сверив скан.
   */
  on('deal.act_issued', async (event) => {
    const dealId = String(event.payload.dealId)
    const already = await documents.listForDeal(dealId)
    if (already.some((doc) => doc.kind === 'act' && doc.status !== 'void')) {
      log.info({ eventId: event.id, dealId }, 'акт по сделке уже выпущен, пропускаем')
      return
    }

    const made = await deal.getDeal(OPERATOR, dealId)
    await issueFor(made, ['act'])
    log.info({ eventId: event.id, dealId }, 'выпущен акт')
  })
}

/**
 * Воркер работает не от чьего-то имени: он система. Права у него как
 * у оператора — иначе он не прочитает сделку, чтобы выпустить по ней счёт.
 */
const OPERATOR = {
  id: '00000000-0000-0000-0000-000000000000',
  orgId: '00000000-0000-0000-0000-000000000000',
  role: 'operator' as const,
}

/**
 * Выпустить документы по сделке.
 *
 * Позиция одна — то, что заказали. Когда в сделке появятся несколько услуг,
 * их станет несколько, а документ от этого не изменится: он уже собирается
 * из списка.
 */
async function issueFor(made: deal.Deal, kinds: documents.DocumentKind[]): Promise<void> {
  const price = made.priceKopecks ?? 0n
  const contractorName = made.contractorId
    ? await contractorNameOf(made.contractorId)
    : undefined

  for (const kind of kinds) {
    await documents.issue({
      kind,
      dealId: made.id,
      dealNumber: made.number,
      clientOrgId: made.clientOrgId,
      contractorId: made.contractorId ?? undefined,
      contractorName,
      /**
       * ДОПУЩЕНИЕ НА ПИЛОТ (Q25). Оператор ЭДО не выбран, проверять
       * квалифицированную подпись нечем. Но и бумажный путь целиком
       * оставить нельзя: на нём акт отмечает оператор, сверив скан,
       * а загрузки сканов пока тоже нет — клиент не смог бы принять
       * работу вообще.
       *
       * Поэтому путь электронный, а в самой подписи записано, чем она
       * подтверждена: сейчас это нажатие в системе, то есть простая
       * подпись, а не усиленная квалифицированная. Врать в документе
       * «подписано УКЭП» нельзя, и код этого не делает.
       */
      signingPath: 'electronic',
      items: [
        {
          title: made.title ?? `Заказ № ${made.number}`,
          qty: made.qty ?? '1',
          unit: made.unit ?? 'услуга',
          priceKopecks: price,
          totalKopecks: price,
        },
      ],
    })
  }
}

async function contractorNameOf(contractorId: string): Promise<string | undefined> {
  try {
    const contractor = await catalog.getContractor(contractorId)
    const org = await platform.getOrg(contractor.orgId)
    return org.name
  } catch {
    // Название подрядчика — подпись в документе, а не его основа:
    // без него документ выпустить можно, без счёта — нельзя
    return undefined
  }
}

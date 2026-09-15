/**
 * События, которые публикует `intake`. Кто на них подписан — не его дело (§4.5).
 *
 * В полезной нагрузке идентификаторы и значения, никогда объекты чужих
 * модулей. И никогда — персональные данные: очередь хранит их открытым
 * текстом, а ФИО и телефон клиента там не нужны никому из подписчиков.
 */
export type RequestCreated = {
  type: 'request.created'
  payload: {
    requestId: string
    number: number
    clientOrgId: string
    categoryId: string | null
    zoneCode: string | null
    urgency: string
  }
}

export type IntakeEvent = RequestCreated

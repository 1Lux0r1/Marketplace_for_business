import * as service from './service'

/**
 * Публичный интерфейс модуля `notifications`.
 *
 * Соседи не знают, чем и куда мы отправляем: они говорят «сообщи человеку то-то»,
 * а канал, шаблон и повторы — забота этого модуля. Поэтому смена почтового
 * шлюза не трогает ни регистрацию, ни сделку.
 *
 * Пока письма уходят прямо из обработчика запроса. В задаче 01-3 появится
 * очередь событий, и отправка переедет в воркер: человек не должен ждать
 * почтовый сервер, чтобы увидеть, что регистрация прошла.
 */

export type { TemplateName } from './templates'
export type { SendInput } from './service'

export const sendEmail = service.sendEmail
export const historyFor = service.historyFor

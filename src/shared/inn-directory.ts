import { config } from './config'
import { checkInn } from './inn'

/**
 * Справочник компаний по ИНН. ЕДИНСТВЕННАЯ точка подключения внешнего сервиса.
 *
 * Поставщик не выбран (Q20 в `docs/06-open-questions.md`), поэтому по умолчанию
 * здесь заглушка, которая честно отвечает «не знаю». Это не временный костыль,
 * а рабочее состояние: регистрация от этого не страдает, заявка просто уходит
 * оператору на ручную проверку.
 *
 * Когда поставщик появится, меняется одна функция ниже и одна строка в `.env`.
 * Ни регистрация, ни экраны, ни события про поставщика не знают.
 *
 * ЧЕГО ЗДЕСЬ НЕЛЬЗЯ ДЕЛАТЬ НИКОГДА: тянуть данные с веб-страниц справочника.
 * Это ломается при любом изменении их сайта и обычно запрещено их правилами.
 * Нужен именно интерфейс для программ.
 *
 * Персональные данные: ФИО руководителя — это они, значит справочник должен
 * хранить данные в РФ (§8). Проверять это при выборе поставщика, а не после.
 */

export type InnLookup =
  /** Компания найдена. `director` может отсутствовать — не все отдают руководителя. */
  | { status: 'found'; name: string; director: string | null; active: boolean; raw: unknown }
  /** Справочник ответил, что такой компании нет. */
  | { status: 'not_found' }
  /** Номер не сходится по контрольной сумме — до справочника дело не дошло. */
  | { status: 'bad_inn'; reason: string }
  /** Справочник не ответил, ответил неуверенно или не подключён. */
  | { status: 'unavailable'; reason: string }

export async function lookupInn(inn: string): Promise<InnLookup> {
  const checked = checkInn(inn)
  if (!checked.ok) return { status: 'bad_inn', reason: checked.error }

  const cfg = config()
  if (cfg.INN_LOOKUP_PROVIDER === 'none') {
    return { status: 'unavailable', reason: 'справочник не подключён' }
  }

  // Сюда придёт вызов выбранного поставщика. Обязательные свойства этого
  // вызова, что бы ни выбрали: таймаут (иначе он повесит воркер) и возврат
  // `unavailable` вместо исключения при любой внешней беде.
  return Promise.resolve({
    status: 'unavailable',
    reason: `поставщик «${cfg.INN_LOOKUP_PROVIDER}» ещё не подключён в коде`,
  })
}

/**
 * Совпадает ли заявленное ФИО с руководителем из реестра.
 *
 * Сверка нарочно нестрогая: отсутствующее отчество, «ё» вместо «е»,
 * другой порядок слов — это норма, а не подлог. Строгая сверка выдавала бы
 * отказ настоящим директорам, а это дороже, чем пропустить однофамильца:
 * настоящее подтверждение полномочий даёт не эта проверка, а подпись
 * на первом документе.
 */
export function namesMatch(claimed: string, registry: string): boolean {
  const parts = (value: string) =>
    value
      .toLowerCase()
      .replaceAll('ё', 'е')
      .split(/[\s.]+/u)
      .filter((part) => part.length > 1)

  const a = parts(claimed)
  const b = parts(registry)
  if (a.length === 0 || b.length === 0) return false

  // Фамилия и имя должны найтись оба; отчество — если названо обеими сторонами
  const common = a.filter((part) => b.includes(part))
  return common.length >= Math.min(2, Math.min(a.length, b.length))
}

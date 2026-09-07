export type ZoneKind = 'district' | 'city'

export type Zone = {
  code: string
  name: string
  kind: ZoneKind
}

/**
 * Зоны обслуживания. ЕДИНСТВЕННЫЙ источник кодов зон в системе.
 *
 * Лежит в `shared`, а не в модуле, потому что это общий словарь, а не логика
 * одного модуля: коды зон нужны и каталогу (где работает подрядчик), и точке
 * клиента (куда он приезжает). Модуль-владелец здесь означал бы кольцо
 * в зависимостях, а словарь без состояния и без логики владельца не требует.
 *
 * Заявка, карточка подрядчика и фильтр витрины берут коды отсюда — руками
 * их не вводит никто. Иначе в базе неизбежно окажутся «msk-cao», «МСК-ЦАО»
 * и «центр», и подбор по зоне перестанет находить половину подрядчиков.
 *
 * Пока это Москва: округа плюс город целиком для тех, кто выезжает везде.
 * Другие города добавляются сюда же — таблица для этого не нужна, список
 * меняется раз в год и должен меняться через код-ревью, а не через базу.
 */
const ZONES: readonly Zone[] = [
  { code: 'msk', name: 'Москва целиком', kind: 'city' },
  { code: 'msk-cao', name: 'Центральный', kind: 'district' },
  { code: 'msk-sao', name: 'Северный', kind: 'district' },
  { code: 'msk-svao', name: 'Северо-Восточный', kind: 'district' },
  { code: 'msk-vao', name: 'Восточный', kind: 'district' },
  { code: 'msk-uvao', name: 'Юго-Восточный', kind: 'district' },
  { code: 'msk-uao', name: 'Южный', kind: 'district' },
  { code: 'msk-uzao', name: 'Юго-Западный', kind: 'district' },
  { code: 'msk-zao', name: 'Западный', kind: 'district' },
  { code: 'msk-szao', name: 'Северо-Западный', kind: 'district' },
  { code: 'msk-zelao', name: 'Зеленоградский', kind: 'district' },
  { code: 'msk-nao', name: 'Новомосковский', kind: 'district' },
  { code: 'msk-tao', name: 'Троицкий', kind: 'district' },
]

export function listZones(): Zone[] {
  return [...ZONES]
}

export function findZone(code: string): Zone | undefined {
  return ZONES.find((zone) => zone.code === code)
}

export function isKnownZone(code: string): boolean {
  return findZone(code) !== undefined
}

/**
 * Зона города покрывает все свои округа: подрядчик, работающий по всей Москве,
 * должен находиться и по запросу «Центральный округ».
 */
export function coveringCodes(code: string): string[] {
  const zone = findZone(code)
  if (!zone || zone.kind === 'city') return [code]
  const city = code.split('-')[0]
  return city && city !== code ? [code, city] : [code]
}

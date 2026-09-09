import { describe, expect, it } from 'vitest'
import { listZones } from '@/modules/catalog'
import { zoneNames } from './zone-names'

describe('коды зон не протекают в интерфейс (§7.1)', () => {
  it('округ показывается названием, а не кодом', () => {
    expect(zoneNames(['msk-cao', 'msk-sao'])).toEqual(['Центральный', 'Северный'])
  })

  it('ни одно название не выглядит кодом: латиница и дефисы — это системное', () => {
    const names = zoneNames(listZones().map((zone) => zone.code))
    expect(names.filter((name) => /[a-z]/i.test(name))).toEqual([])
  })

  it('незнакомый код показывается как есть, а не исчезает', () => {
    // Пустое место читалось бы как «подрядчик никуда не выезжает»
    expect(zoneNames(['spb-center'])).toEqual(['spb-center'])
  })
})

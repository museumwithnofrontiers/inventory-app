import { describe, expect, it } from 'vitest'

import { legacyLocation } from '../../src/exporters/item-exporter.js'

// Legacy parity story #2233, C8 and C9: the Location line as legacy composes it.
describe('legacyLocation', () => {
  it('drops the trailing period of each part', () => {
    expect(legacyLocation('Mértola., Beja.')).toBe('Mértola, Beja')
  })

  it('spares a period after C, as in B.C.', () => {
    expect(legacyLocation('Site of 100 B.C.')).toBe('Site of 100 B.C.')
  })

  it('puts a monument address first, keeping its lines', () => {
    expect(legacyLocation('Bursa., Bursa', 'Çekirge Caddesi\nOsmangazi.')).toBe(
      'Çekirge Caddesi  \nOsmangazi, Bursa, Bursa'
    )
  })

  it('returns null when there is nothing to show', () => {
    expect(legacyLocation(null, null)).toBeNull()
  })
})

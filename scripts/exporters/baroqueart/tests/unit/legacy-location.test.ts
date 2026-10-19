import { describe, expect, it } from 'vitest'

import { legacyLocation } from '../../src/exporters/item-exporter.js'

// Legacy parity story #2233, C9: the Location line as legacy composes it.
describe('legacyLocation', () => {
  it('drops the trailing period of each part', () => {
    expect(legacyLocation('Viseu., Viseu.')).toBe('Viseu, Viseu')
  })

  it('spares a period after C, as in B.C.', () => {
    expect(legacyLocation('Site of 100 B.C.')).toBe('Site of 100 B.C.')
  })

  it('keeps an empty location empty', () => {
    expect(legacyLocation(null)).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'

import { legacyTagId } from '../../src/exporters/tag-exporter.js'

/**
 * A THG tag that matched an existing mwnf3 tag was deduplicated by the importer
 * (ThgTagImporter), which appends the THG key to the one already there. So the
 * THG segment has to be searched for inside a semicolon-delimited value, not
 * assumed to be the whole thing — assuming would strip the facet id from every
 * deduplicated tag and break the legacy search deep links.
 */
describe('legacyTagId', () => {
  it('reads the tag id from a THG-only key', () => {
    expect(legacyTagId('thg:tags:material_1a59')).toBe('material_1a59')
  })

  it('finds the THG segment in a deduplicated multi-key value', () => {
    expect(legacyTagId('mwnf3:tags:material:eng:carnelian;thg:tags:material_1ce4')).toBe(
      'material_1ce4'
    )
  })

  it('tolerates surrounding whitespace between segments', () => {
    expect(legacyTagId('mwnf3:tags:type:eng:amulet ; thg:tags:type_1b81')).toBe('type_1b81')
  })

  it('returns null when no THG segment is present', () => {
    expect(legacyTagId('mwnf3:tags:keyword:eng:talisman')).toBeNull()
    expect(legacyTagId('')).toBeNull()
  })
})

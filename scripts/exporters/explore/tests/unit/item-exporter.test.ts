import { describe, expect, it } from 'vitest'

import { isHbHcrOnly } from '../../src/exporters/item-exporter.js'

/**
 * legacy_display_status: 'N' ("HB/HCR illustration only") excludes an item
 * from database search and PC browse on the legacy site. The importer's
 * SH-specific step stamps it onto the item's Sharing History context row —
 * which is not always the row treated as "own" for content purposes: an
 * item also imported directly under a different project has its "own"
 * context resolved from that other project instead. Checking only "own"
 * missed the flag entirely for those items (confirmed live: 9 sharinghistory
 * monuments would have flipped from hidden to publicly visible).
 */
describe('isHbHcrOnly', () => {
  it('is true when the flag is on the only row', () => {
    expect(isHbHcrOnly([{ extra: { legacy_display_status: 'N' } }])).toBe(true)
  })

  it('is true when the flag is on a row other than the first one', () => {
    // Simulates: ownRow (this item's own project context) has no flag, but
    // its Sharing History context row — a different row for the same
    // item/language — does.
    expect(
      isHbHcrOnly([
        { extra: { some_other_field: 'x' } },
        { extra: { legacy_display_status: 'N' } },
      ])
    ).toBe(true)
  })

  it('is false when no row carries the flag', () => {
    expect(isHbHcrOnly([{ extra: { some_other_field: 'x' } }, { extra: null }])).toBe(false)
  })

  it('is false for an item with no translation rows at all', () => {
    expect(isHbHcrOnly([])).toBe(false)
  })

  it('handles extra delivered as a JSON string (defensive mysql2 path)', () => {
    expect(isHbHcrOnly([{ extra: JSON.stringify({ legacy_display_status: 'N' }) }])).toBe(true)
  })

  it('ignores a legacy_display_status value other than N', () => {
    expect(isHbHcrOnly([{ extra: { legacy_display_status: 'A' } }])).toBe(false)
  })
})

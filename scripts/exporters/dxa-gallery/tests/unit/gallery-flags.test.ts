import { describe, expect, it } from 'vitest'

import { bitToBoolean, isFeatured, isHidden } from '../../src/exporters/gallery-exporter.js'

/**
 * `featured` and `status` share the enum('A','H') but mean different things —
 * `status` is site-wide visibility, `featured` is membership of the portal's
 * highlight strip (thg_gallery DDL column comments). dxa-api reports `featured`
 * inverted because it copied the `hidden` projection without flipping it; the
 * exporter ships the documented meaning instead. These tests pin that choice so
 * a later parity check against the live API does not "correct" it back.
 *
 * Carpets is the useful case to keep pinned, because it disagrees with the live
 * API in the opposite direction from amulets: gallery 9 is featured='A' and
 * `/thg/galleries/self` answers `featured: false`.
 */
describe('isFeatured', () => {
  it("treats 'A' as featured — the carpets case, against the live API's featured: false", () => {
    expect(isFeatured('A')).toBe(true)
  })

  it("treats 'H' as not featured — the amulets case, against the live API's featured: true", () => {
    expect(isFeatured('H')).toBe(false)
  })

  it('treats a missing flag as not featured, matching the column default', () => {
    expect(isFeatured(undefined)).toBe(false)
    expect(isFeatured(null)).toBe(false)
  })
})

describe('isHidden', () => {
  it("shows a gallery only when status is 'A'", () => {
    expect(isHidden('A')).toBe(false)
    expect(isHidden('H')).toBe(true)
    expect(isHidden(undefined)).toBe(true)
  })

  it('is independent of featured — gallery 54 is hidden yet featured', () => {
    expect(isHidden('H')).toBe(true)
    expect(isFeatured('A')).toBe(true)
  })
})

/**
 * `has_timeline` / `has_country_timeline` are MySQL bit(1). The importer
 * normalizes them to JSON booleans, but rows written before that fix still hold
 * the raw mysql2 Buffer shape — and a naive read would treat that object as
 * truthy and report a timeline the site does not have.
 */
describe('bitToBoolean', () => {
  it('accepts the normalized boolean form', () => {
    expect(bitToBoolean(true)).toBe(true)
    expect(bitToBoolean(false)).toBe(false)
  })

  it('accepts the raw mysql2 Buffer form left by older imports', () => {
    expect(bitToBoolean({ type: 'Buffer', data: [1] })).toBe(true)
    expect(bitToBoolean({ type: 'Buffer', data: [0] })).toBe(false)
  })

  it('accepts numeric and string encodings', () => {
    expect(bitToBoolean(1)).toBe(true)
    expect(bitToBoolean(0)).toBe(false)
    expect(bitToBoolean('1')).toBe(true)
    expect(bitToBoolean('true')).toBe(true)
    expect(bitToBoolean('0')).toBe(false)
  })

  it('defaults to false for absent or unrecognized values', () => {
    expect(bitToBoolean(null)).toBe(false)
    expect(bitToBoolean(undefined)).toBe(false)
    expect(bitToBoolean({})).toBe(false)
  })
})

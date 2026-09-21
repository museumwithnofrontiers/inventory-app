import { describe, expect, it } from 'vitest'

import { bannerRefToBackwardCompatibility } from '../../src/core/banner-reference.js'

/**
 * `thg_gallery.banner_item` is the only place a gallery names an item by legacy
 * composite key. Getting the shape wrong loses the home-page banner silently —
 * the export still succeeds, the banner is just null — so every legacy form is
 * pinned here.
 */
describe('bannerRefToBackwardCompatibility', () => {
  it('maps an mwnf3 object reference (the carpets banner) to its item key', () => {
    expect(bannerRefToBackwardCompatibility('mwnf#obj#DCA;uk;Mus31;19')).toBe(
      'mwnf3:objects:DCA:uk:Mus31:19'
    )
  })

  it('maps an mwnf3 monument reference', () => {
    expect(bannerRefToBackwardCompatibility('mwnf#mon#ISL;jo;Ins01;7')).toBe(
      'mwnf3:monuments:ISL:jo:Ins01:7'
    )
  })

  it('lowercases Sharing History keys, which have no partner segment', () => {
    expect(bannerRefToBackwardCompatibility('sh#obj#AWE;JO;35')).toBe(
      'mwnf3_sharing_history:sh_objects:awe:jo:35'
    )
    expect(bannerRefToBackwardCompatibility('sh#mon#AWE;jo;12')).toBe(
      'mwnf3_sharing_history:sh_monuments:awe:jo:12'
    )
  })

  it('tolerates whitespace around the key segments', () => {
    expect(bannerRefToBackwardCompatibility('mwnf#obj# EPM ; at ; Mus22 ; 51 ')).toBe(
      'mwnf3:objects:EPM:at:Mus22:51'
    )
  })

  it('returns null for an absent reference', () => {
    expect(bannerRefToBackwardCompatibility(null)).toBeNull()
    expect(bannerRefToBackwardCompatibility(undefined)).toBeNull()
    expect(bannerRefToBackwardCompatibility('')).toBeNull()
  })

  it('returns null rather than guessing when the reference is malformed', () => {
    // Wrong segment count for the keyspace: an mwnf3 key without its partner.
    expect(bannerRefToBackwardCompatibility('mwnf#obj#EPM;at;51')).toBeNull()
    // A partner segment on an SH key, which has none.
    expect(bannerRefToBackwardCompatibility('sh#obj#AWE;jo;Mus01;35')).toBeNull()
    // Unknown database and unknown item type.
    expect(bannerRefToBackwardCompatibility('bar#obj#BAR;pt;Mus01;3')).toBeNull()
    expect(bannerRefToBackwardCompatibility('mwnf#detail#EPM;at;Mus22;51')).toBeNull()
    // Not a composite key at all.
    expect(bannerRefToBackwardCompatibility('12345')).toBeNull()
  })
})

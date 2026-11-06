import { describe, expect, it } from 'vitest'

import {
  GLOBAL_TIMELINE_LIKE_PATTERNS,
  isGlobalCountryTimeline,
  timelineSource,
} from '../../src/exporters/timeline-exporter.js'

/**
 * The DXA global timeline is a MERGE of two chronologies, and both halves of the
 * rule are easy to get wrong in opposite directions:
 *
 *  - too narrow (`mwnf3:hcr:country:%` alone, which is what the amulets fork
 *    ships) loses the Sharing History "Political Context" chronology: 8 of the
 *    26 countries the live API serves disappear and 315 of its 1,390 events go
 *    with them;
 *  - too wide (`mwnf3:hcr:%`) pulls in the Baroque Art chronology, which is a
 *    different site's data.
 *
 * These cases pin both edges. `isGlobalCountryTimeline` evaluates the very same
 * `GLOBAL_TIMELINE_LIKE_PATTERNS` array the SQL binds, so a change to the query
 * cannot pass while leaving the rule here untouched.
 */
describe('isGlobalCountryTimeline', () => {
  it('accepts the Discover Islamic Art country chronologies', () => {
    expect(isGlobalCountryTimeline('mwnf3:hcr:country:dz')).toBe(true)
    expect(isGlobalCountryTimeline('mwnf3:hcr:country:uk')).toBe(true)
  })

  it('accepts the Sharing History chronology, but only exhibition 2', () => {
    // "Political Context" — the exhibition dxa-api hardcodes in
    // app/MWNF/SQL/sh/Events.blade.php.
    expect(isGlobalCountryTimeline('mwnf3_sharing_history:sh_hcr:country:at:exhibition:2')).toBe(
      true
    )
    expect(isGlobalCountryTimeline('mwnf3_sharing_history:sh_hcr:country:gr:exhibition:2')).toBe(
      true
    )
  })

  it('rejects the other Sharing History exhibitions', () => {
    for (const exhibition of [1, 3, 4, 5, 8, 9, 10, 11]) {
      expect(
        isGlobalCountryTimeline(`mwnf3_sharing_history:sh_hcr:country:at:exhibition:${exhibition}`)
      ).toBe(false)
    }
  })

  /**
   * North Macedonia is the proof that filtering on exhibition 2 is the real
   * rule rather than a coincidence: it has exhibitions 4, 5, 8 and 9 and no
   * exhibition 2, and the live `/events/count?ic[]=mc` answers 0.
   */
  it('excludes a country whose only Sharing History exhibitions are not 2', () => {
    expect(isGlobalCountryTimeline('mwnf3_sharing_history:sh_hcr:country:mc:exhibition:4')).toBe(
      false
    )
    expect(isGlobalCountryTimeline('mwnf3_sharing_history:sh_hcr:country:mc:exhibition:9')).toBe(
      false
    )
  })

  it('rejects the Baroque Art chronology, which a bare mwnf3:hcr:% would catch', () => {
    expect(isGlobalCountryTimeline('mwnf3:hcr:bar:country:cz')).toBe(false)
    expect(isGlobalCountryTimeline('mwnf3:hcr:bar:country:pt')).toBe(false)
  })

  it('rejects the THG-local exhibition timelines', () => {
    expect(isGlobalCountryTimeline('mwnf3_thematic_gallery:timeline:47')).toBe(false)
  })

  it('rejects absent keys instead of matching everything', () => {
    expect(isGlobalCountryTimeline(null)).toBe(false)
    expect(isGlobalCountryTimeline(undefined)).toBe(false)
    expect(isGlobalCountryTimeline('')).toBe(false)
  })

  /**
   * The `_` in `sh_hcr` is a LIKE single-character wildcard unless escaped, so
   * an unescaped pattern would also match `sh-hcr`, `shXhcr` and friends.
   */
  it('escapes the underscores in the Sharing History keyspace', () => {
    expect(GLOBAL_TIMELINE_LIKE_PATTERNS[1]).toContain('\\_')
    expect(isGlobalCountryTimeline('mwnf3-sharing-history:shXhcr:country:at:exhibition:2')).toBe(
      false
    )
  })
})

describe('timelineSource', () => {
  it('labels each chronology so a viewer can merge them per country', () => {
    expect(timelineSource('mwnf3:hcr:country:dz')).toBe('mwnf3')
    expect(timelineSource('mwnf3_sharing_history:sh_hcr:country:at:exhibition:2')).toBe(
      'sharing_history'
    )
  })

  it('returns null rather than guessing for an unknown or absent key', () => {
    expect(timelineSource(null)).toBeNull()
    expect(timelineSource('something:else')).toBeNull()
  })
})

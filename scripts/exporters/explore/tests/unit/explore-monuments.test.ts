import { describe, expect, it } from 'vitest'
import {
  exploreMonumentsSelect,
  restoreExploreMonuments,
  withExploreMonuments,
} from '../../../shared/explore-monuments.mjs'

const row = (columns: Record<string, unknown>) => ({
  position: 1,
  key: null,
  latitude: null,
  longitude: null,
  map_zoom: null,
  location: null,
  description_types: null,
  travels_description_ref: null,
  explore_description_ref: null,
  virtual_museum_description_ref: null,
  museums: null,
  ...columns,
})

describe('withExploreMonuments', () => {
  it("puts a location's list, coordinates and museums back, in MySQL JSON key order", () => {
    const extra = withExploreMonuments(null, {
      explore_collection_source: 'mwnf3_explore:location:508',
      explore_monuments: JSON.stringify([
        row({ position: 2, key: 'mwnf3_explore:monument:1300' }),
        row({
          position: 1,
          key: 'mwnf3_explore:monument:1275',
          latitude: 34.030727,
          longitude: -6.835677,
          map_zoom: 16,
          museums: [
            { order: 2, key: 'mwnf3:museums:Mus01_A:ma' },
            { order: 1, key: 'mwnf3:museums:Mus01_B:ma' },
          ],
        }),
      ]),
    }) as Record<string, Record<string, unknown>>
    expect(JSON.stringify(extra)).toBe(
      JSON.stringify({
        explore_geo: { '1275': { latitude: 34.030727, map_zoom: 16, longitude: -6.835677 } },
        explore_museums: { '1275': ['mwnf3:museums:Mus01_B:ma', 'mwnf3:museums:Mus01_A:ma'] },
        explore_monument_ids: [1275, 1300],
      })
    )
  })

  it("puts an itinerary's monument, location and references back", () => {
    const extra = withExploreMonuments('{"mn_order": 3}', {
      explore_collection_source: 'mwnf3_explore:itinerary:12',
      explore_monuments: [
        row({
          key: 'mwnf3_explore:monument:1440',
          location: 'mwnf3_explore:location:539',
          description_types: 'ET#1',
          travels_description_ref: 'IAM;dz;III;3;d;en;1#1',
        }),
      ],
    })
    expect(JSON.stringify(extra)).toBe(
      JSON.stringify({
        mn_order: 3,
        desc_types: 'ET#1',
        tr_mn_desc: 'IAM;dz;III;3;d;en;1#1',
        location_id: 539,
        explore_monument_id: 1440,
      })
    )
  })

  it('leaves extra as it came without rows', () => {
    expect(withExploreMonuments(null, { explore_monuments: null })).toBeNull()
    expect(withExploreMonuments('{"a": 1}', { explore_monuments: [] })).toBe('{"a": 1}')
  })
})

describe('restoreExploreMonuments', () => {
  it('restores each row and removes the selected columns', () => {
    const rows = restoreExploreMonuments([
      {
        extra: null,
        explore_collection_source: 'mwnf3_explore:location:1',
        explore_monuments: [row({ key: 'mwnf3_explore:monument:7' })],
      },
    ])
    expect(rows).toEqual([{ extra: { explore_monument_ids: [7] } }])
  })

  it('selects the rows of the aliased placement', () => {
    const select = exploreMonumentsSelect('ci')
    expect(select).toContain('em_m.collection_item_id = ci.id')
    expect(select).toContain('em_c.id = ci.collection_id')
  })
})

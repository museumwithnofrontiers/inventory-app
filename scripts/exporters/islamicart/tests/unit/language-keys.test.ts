import { describe, expect, it } from 'vitest'

import { languageKeyer } from '../../src/core/language-keys.js'
import { buildCollectionItemEntry } from '../../src/exporters/collection-exporter.js'

// The package keys languages by their legacy code. A placement's captions
// hold legacy codes today and language ids after #2394: both come out as the
// legacy code.
const key = languageKeyer(
  new Map([
    ['eng', 'en'],
    ['swe', 'se'],
  ])
)
const url = (path: string) => `https://example.org/pub/${path}`

describe('language keys in a placement', () => {
  it('captions keyed by language id come out keyed by the legacy code', () => {
    const entry = buildCollectionItemEntry(
      {
        collection_id: 'page',
        item_id: 'item',
        display_order: 1,
        picture_path: null,
        extra: {
          item_name: { eng: 'Name', swe: 'Namn' },
          details: [{ picture_details: 'd.jpg', detail_name: { eng: 'Detail' } }],
        },
      },
      url,
      key
    )
    expect(entry.caption).toEqual({
      en: { name: 'Name' },
      se: { name: 'Namn' },
    })
    expect(entry.details?.[0]?.caption).toEqual({
      en: { detail_name: 'Detail' },
    })
  })

  it('captions keyed by the legacy code come out as they went in', () => {
    const entry = buildCollectionItemEntry(
      {
        collection_id: 'page',
        item_id: 'item',
        display_order: 1,
        picture_path: null,
        extra: { item_name: { en: 'Name', se: 'Namn' } },
      },
      url,
      key
    )
    expect(entry.caption).toEqual({
      en: { name: 'Name' },
      se: { name: 'Namn' },
    })
  })
})

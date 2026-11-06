import { describe, expect, it } from 'vitest'

import { languageKeyer } from '../../src/core/language-keys.js'
import { buildCollectionItemEntry } from '../../src/exporters/collection-exporter.js'

// The package keys languages by their legacy code. A placement's captions
// hold legacy codes today and language ids after #2394: both come out as the
// legacy code.
const key = languageKeyer(
  new Map([
    ['eng', 'en'],
    ['ita', 'it'],
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
        extra: { item_name: { eng: 'Name', ita: 'Nome' } },
      },
      url,
      [],
      key
    )
    expect(entry.caption).toEqual({
      en: { name: 'Name' },
      it: { name: 'Nome' },
    })
  })

  it('captions keyed by the legacy code come out as they went in', () => {
    const entry = buildCollectionItemEntry(
      {
        collection_id: 'page',
        item_id: 'item',
        display_order: 1,
        picture_path: null,
        extra: { item_name: { en: 'Name' } },
      },
      url,
      [],
      key
    )
    expect(entry.caption).toEqual({ en: { name: 'Name' } })
  })
})

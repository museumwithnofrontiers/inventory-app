import { describe, expect, it } from 'vitest'

import { languageKeyer } from '../../src/core/language-keys.js'
import { collectionTextExtra } from '../../src/exporters/collection-exporter.js'

// The package keys languages by their legacy code. A theme's country texts
// name their language by its legacy code today and by its id after #2394:
// both come out as the legacy code.
const key = languageKeyer(
  new Map([
    ['eng', 'en'],
    ['fra', 'fr'],
  ])
)

describe('language keys in a collection text', () => {
  it("a country text's language id comes out as its legacy code", () => {
    const extra = {
      country_ids: ['es'],
      country_texts: [{ countryId: 'es', langId: 'fra', text: 'Texte' }],
    }
    expect(collectionTextExtra(extra, key)).toEqual({
      country_ids: ['es'],
      country_texts: [{ countryId: 'es', langId: 'fr', text: 'Texte' }],
    })
  })

  it('a legacy code, or a text without country texts, comes out as it went in', () => {
    const coded = {
      country_texts: [{ countryId: 'es', langId: 'en', text: 'Text' }],
    }
    expect(collectionTextExtra(coded, key)).toEqual(coded)
    expect(collectionTextExtra({ explore_itinerary: { a: 1 } }, key)).toEqual({
      explore_itinerary: { a: 1 },
    })
    expect(collectionTextExtra(null, key)).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'

import { languageKeyer, rekeyLanguages } from '../../src/core/language-keys.js'
import {
  buildCollectionItemEntry,
  collectionTextExtra,
} from '../../src/exporters/collection-exporter.js'

// The package keys languages by their legacy code. `extra` holds legacy
// codes today and language ids after #2394: both come out as the legacy code.
const key = languageKeyer(
  new Map([
    ['eng', 'en'],
    ['fra', 'fr'],
    ['swe', 'se'],
  ])
)
const url = (path: string) => `https://example.org/pub/${path}`

describe('language keys in extra', () => {
  it('writes an id as its legacy code and keeps a legacy code or an unknown key', () => {
    expect(key('swe')).toBe('se')
    expect(key('se')).toBe('se')
    expect(key('xyz')).toBe('xyz')
  })

  it('keeps the order, and the first of one language written both ways', () => {
    expect(Object.keys(rekeyLanguages({ fra: 1, en: 2, eng: 3 }, key))).toEqual(['fr', 'en'])
    expect(rekeyLanguages({ en: 2, eng: 3 }, key)).toEqual({ en: 2 })
  })

  it('a collection text: its bibliographies, captions and map texts', () => {
    const extra = {
      bibliography: { eng: 'Book' },
      disabled_bibliography: { fra: 'Livre' },
      image_captions: { 'img-1': { eng: 'A caption' } },
      map_descriptions: { map_3: { swe: 'Karta' } },
      other: { eng: 'left as it is' },
    }
    expect(collectionTextExtra(extra, key)).toEqual({
      bibliography: { en: 'Book' },
      disabled_bibliography: { fr: 'Livre' },
      image_captions: { 'img-1': { en: 'A caption' } },
      map_descriptions: { map_3: { se: 'Karta' } },
      other: { eng: 'left as it is' },
    })
  })

  it('a legacy-coded collection text comes out as it went in', () => {
    const extra = {
      bibliography: { en: 'Book' },
      image_captions: { 'img-1': { fr: 'Légende' } },
    }
    expect(collectionTextExtra(extra, key)).toEqual(extra)
  })

  it('a placement: its captions, its details and its justifications', () => {
    const entry = buildCollectionItemEntry(
      {
        collection_id: 'theme',
        item_id: 'item',
        display_order: 1,
        extra: {
          item_name: { eng: 'Name', swe: 'Namn' },
          details: [{ picture_details: 'd.jpg', detail_name: { fra: 'Détail' } }],
          justifications: { eng: { partner: 'P', curator: 'C' } },
        },
      },
      url,
      key
    )
    expect(entry.caption).toEqual({
      en: { name: 'Name' },
      se: { name: 'Namn' },
    })
    expect(entry.details).toEqual([
      { image_url: url('d.jpg'), caption: { fr: { detail_name: 'Détail' } } },
    ])
    expect(entry.justifications).toEqual({
      en: { partner: 'P', curator: 'C' },
    })
  })
})

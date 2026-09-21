import { describe, expect, it } from 'vitest'

import { furtherReadingEntry } from '../../src/exporters/related-content-exporter.js'

/**
 * The bibliographies the importer files on `collections.extra.further_readings`
 * because `collection_media` has nowhere to put an entry with no URL. They ship
 * in the same array as the linked entries, distinguished by `kind`.
 */
describe('furtherReadingEntry', () => {
  const langCodeMap = new Map([
    ['eng', 'en'],
    ['deu', 'de'],
  ])

  it('rekeys the texts from inventory language ids to ISO-639-1 codes', () => {
    const entry = furtherReadingEntry(
      {
        legacy_id: 35,
        category_id: 1,
        display_order: 1,
        texts: { eng: '**Theme I**\n\nBlair, S. and Bloom, J.' },
      },
      langCodeMap
    )

    expect(entry).toEqual({
      legacy_id: '35',
      category_id: 1,
      display_order: 1,
      kind: 'text',
      texts: { en: '**Theme I**\n\nBlair, S. and Bloom, J.' },
    })
  })

  it('stringifies legacy_id so it groups with the media-backed entries', () => {
    // relatedContentLegacyId() parses its ids out of a backward_compatibility
    // key and so yields strings; a number here would sort and compare apart.
    const entry = furtherReadingEntry(
      { legacy_id: 31, category_id: 1, display_order: 2, texts: { eng: 'x' } },
      langCodeMap
    )
    expect(entry?.legacy_id).toBe('31')
  })

  it('drops an entry whose languages are all unknown', () => {
    expect(
      furtherReadingEntry(
        { legacy_id: 1, category_id: 1, display_order: 1, texts: { zzz: 'orphaned' } },
        langCodeMap
      )
    ).toBeNull()
  })

  it('drops an entry with no text at all', () => {
    expect(
      furtherReadingEntry({ legacy_id: 1, category_id: 1, display_order: 1, texts: {} }, langCodeMap)
    ).toBeNull()
  })

  it('defaults a missing category and display order rather than emitting undefined', () => {
    const entry = furtherReadingEntry(
      {
        legacy_id: 9,
        category_id: null,
        display_order: undefined as unknown as number,
        texts: { deu: 'Literatur' },
      },
      langCodeMap
    )
    expect(entry).toMatchObject({ category_id: null, display_order: 0, texts: { de: 'Literatur' } })
  })
})

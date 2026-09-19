import { describe, expect, it } from 'vitest'

import type { LogoRow } from '../../src/exporters/exhibition-exporter.js'
import {
  bitToBoolean,
  buildLogoEntry,
  isFeatured,
  isHidden,
} from '../../src/exporters/exhibition-exporter.js'
import { relatedLinkThemeKey } from '../../src/exporters/theme-exporter.js'
import {
  relatedContentKind,
  relatedContentLegacyId,
} from '../../src/exporters/related-content-exporter.js'

/**
 * `featured` and `status` share the enum('A','H') and mean different things.
 * dxa-api conflates them — `WithTHGTemporaryTables.php` builds `featured` from
 * the `hidden` projection without flipping the polarity — so the live API
 * reports `featured: false` for this exhibition even though its record says
 * 'A'. The package ships the documented meaning; these cases pin which one.
 */
describe('isFeatured / isHidden', () => {
  it('reads featured as "is it in the featured strip"', () => {
    expect(isFeatured('A')).toBe(true)
    expect(isFeatured('H')).toBe(false)
  })

  it('reads status as "is it visible at all", with A meaning visible', () => {
    expect(isHidden('A')).toBe(false)
    expect(isHidden('H')).toBe(true)
  })

  /**
   * Gallery 54 is status='H' + featured='A' in the legacy data, which is only
   * possible because the two flags are orthogonal. Reading either through the
   * other would make that row impossible to represent.
   */
  it('keeps the two flags independent', () => {
    expect(isFeatured('A')).toBe(true)
    expect(isHidden('H')).toBe(true)
  })

  it('treats an absent flag as not-featured and hidden', () => {
    expect(isFeatured(null)).toBe(false)
    expect(isFeatured(undefined)).toBe(false)
    expect(isHidden(null)).toBe(true)
  })
})

/**
 * `has_timeline` is a MySQL bit(1). Rows written before the importer normalised
 * it still hold a serialized Node Buffer, and `if (buffer)` is truthy for BOTH
 * `[0]` and `[1]` — so a naive read reports every exhibition as having a
 * timeline.
 */
describe('bitToBoolean', () => {
  it('accepts the normalised JSON booleans', () => {
    expect(bitToBoolean(true)).toBe(true)
    expect(bitToBoolean(false)).toBe(false)
  })

  it('unwraps a serialized mysql2 Buffer instead of reading it as truthy', () => {
    expect(bitToBoolean({ type: 'Buffer', data: [1] })).toBe(true)
    expect(bitToBoolean({ type: 'Buffer', data: [0] })).toBe(false)
  })

  it('accepts the numeric and string spellings', () => {
    expect(bitToBoolean(1)).toBe(true)
    expect(bitToBoolean(0)).toBe(false)
    expect(bitToBoolean('1')).toBe(true)
    expect(bitToBoolean('true')).toBe(true)
    expect(bitToBoolean('0')).toBe(false)
  })

  it('defaults to false for anything it does not recognise', () => {
    expect(bitToBoolean(null)).toBe(false)
    expect(bitToBoolean(undefined)).toBe(false)
    expect(bitToBoolean({})).toBe(false)
  })
})

/**
 * Gap E5: some `theme_item_related` rows point at a picture curated under a
 * DIFFERENT theme. The link is real and must be kept, but the viewer has to be
 * able to tell an in-theme neighbour from a cross-theme jump, which is what the
 * theme segment of the key is for.
 */
describe('relatedLinkThemeKey', () => {
  it('extracts the theme the relation was curated under', () => {
    expect(relatedLinkThemeKey('mwnf3_thematic_gallery:theme_item_related:56:10:1:2')).toBe(
      'mwnf3_thematic_gallery:theme:56:10'
    )
    expect(relatedLinkThemeKey('mwnf3_thematic_gallery:theme_item_related:56:5:4:6')).toBe(
      'mwnf3_thematic_gallery:theme:56:5'
    )
  })

  it('returns null for a key of any other family rather than mangling it', () => {
    expect(relatedLinkThemeKey('mwnf3:link:1234')).toBeNull()
    expect(relatedLinkThemeKey('mwnf3_explore:monument_sh:7')).toBeNull()
    expect(relatedLinkThemeKey(null)).toBeNull()
  })
})

/**
 * The importer files related content twice — once from the base table
 * (`language_id` null) and once per translation — so the exporter groups on the
 * legacy id and lets the translated row win. Getting the id wrong ships the
 * four link entries of this exhibition twice.
 */
describe('relatedContentLegacyId / relatedContentKind', () => {
  it('reads the same legacy id from both keyspaces', () => {
    expect(
      relatedContentLegacyId('mwnf3_thematic_gallery:exhibition_related_content:6:link')
    ).toBe('6')
    expect(
      relatedContentLegacyId('mwnf3_thematic_gallery:exhibition_related_content_i18n:6:en:link')
    ).toBe('6')
  })

  it('ignores keys from other families', () => {
    expect(relatedContentLegacyId('mwnf3_thematic_gallery:exhibition_logo:4')).toBeNull()
    expect(relatedContentLegacyId(null)).toBeNull()
  })

  it('separates an external link from a legacy-hosted document', () => {
    expect(relatedContentKind('mwnf3_thematic_gallery:exhibition_related_content:6:link')).toBe(
      'link'
    )
    expect(
      relatedContentKind('mwnf3_thematic_gallery:exhibition_related_content_i18n:1:en:document')
    ).toBe('document')
    expect(relatedContentKind('mwnf3_thematic_gallery:exhibition_related_content:6:other')).toBeNull()
  })
})

/**
 * The sponsor logo's caption, hyperlink and banner slot ride in
 * `collection_images.extra` (museumwithnofrontiers/inventory-app#1592). Everything the
 * exporter does with that column is failure handling: the column may be absent,
 * NULL or malformed, a key may be missing, and the language maps are keyed by
 * the inventory's 3-char id while the package emits 2-char codes. A throw here
 * would abort the whole export, so each case degrades to a renderable entry.
 */
describe('buildLogoEntry', () => {
  const langCodeMap = new Map([
    ['eng', 'en'],
    ['deu', 'de'],
  ])

  const row = (extra: unknown): LogoRow => ({
    id: 'a1b2',
    path: 'stored-name.jpg',
    original_name: 'unaoc_logo.jpg',
    alt_text: 'UNAOC',
    display_order: 1,
    extra,
  })

  const url = 'https://inventory.example/pub/stored-name.jpg'

  it('carries the whole payload, with language maps re-keyed to 2-char codes', () => {
    const entry = buildLogoEntry(
      row(
        JSON.stringify({
          link: 'https://www.unaoc.org/',
          category_id: 2,
          category_name: 'Footer 2',
          visible: true,
          labels: {
            eng: 'United Nations Alliance of Civilizations',
            deu: 'Allianz der Zivilisationen',
          },
          alts: { eng: 'UNAOC logo' },
          further_readings: { eng: 'About the Alliance' },
        })
      ),
      url,
      langCodeMap
    )

    expect(entry).toEqual({
      id: 'a1b2',
      image_url: url,
      legacy_path: 'unaoc_logo.jpg',
      alt_text: 'UNAOC',
      url: 'https://www.unaoc.org/',
      labels: {
        en: 'United Nations Alliance of Civilizations',
        de: 'Allianz der Zivilisationen',
      },
      alt_texts: { en: 'UNAOC logo' },
      further_readings: { en: 'About the Alliance' },
      category: 'Footer 2',
      category_id: 2,
      visible: true,
      display_order: 1,
    })
  })

  /**
   * The state of every row until the importer's backfill has run, and of any
   * logo legacy left blank. The image still has to ship.
   */
  it('degrades to the image alone when extra is absent or NULL', () => {
    for (const extra of [null, undefined]) {
      const entry = buildLogoEntry(row(extra), url, langCodeMap)
      expect(entry.image_url).toBe(url)
      expect(entry.alt_text).toBe('UNAOC')
      expect(entry.url).toBeNull()
      expect(entry.category).toBeNull()
      expect(entry.category_id).toBeNull()
      expect(entry.labels).toEqual({})
      expect(entry.alt_texts).toEqual({})
      expect(entry.further_readings).toEqual({})
      // Absent is not hidden: legacy's default is visible.
      expect(entry.visible).toBe(true)
    }
  })

  it('treats malformed JSON as no payload rather than throwing', () => {
    const entry = buildLogoEntry(row('{"link": "https://www.unaoc.org'), url, langCodeMap)
    expect(entry.url).toBeNull()
    expect(entry.labels).toEqual({})
    expect(entry.visible).toBe(true)
  })

  it('reads an already-parsed object as well as a JSON string', () => {
    const entry = buildLogoEntry(
      row({ link: 'https://www.unaoc.org/', labels: { eng: 'UNAOC' } }),
      url,
      langCodeMap
    )
    expect(entry.url).toBe('https://www.unaoc.org/')
    expect(entry.labels).toEqual({ en: 'UNAOC' })
  })

  it('reports a missing or empty link as null, so the viewer renders plain art', () => {
    expect(buildLogoEntry(row(JSON.stringify({ category_id: 0 })), url, langCodeMap).url).toBeNull()
    expect(buildLogoEntry(row(JSON.stringify({ link: '' })), url, langCodeMap).url).toBeNull()
  })

  /**
   * Hidden logos are imported on purpose — the inventory is the system of
   * record — so the flag must survive to the package for the viewer to act on.
   */
  it('keeps visible: false instead of dropping the entry', () => {
    const entry = buildLogoEntry(row(JSON.stringify({ visible: false })), url, langCodeMap)
    expect(entry.visible).toBe(false)
  })

  it('keeps category_id 0 (Header) rather than reading it as absent', () => {
    const entry = buildLogoEntry(
      row(JSON.stringify({ category_id: 0, category_name: 'Header' })),
      url,
      langCodeMap
    )
    expect(entry.category_id).toBe(0)
    expect(entry.category).toBe('Header')
  })

  /**
   * A language the inventory carries no 2-char code for would otherwise put a
   * 3-char key next to 'en' in the same map — the viewer looks up by 2-char
   * code and every other language field of the package is 2-char keyed.
   */
  it('skips a language absent from the code map instead of leaking its id', () => {
    const entry = buildLogoEntry(
      row(JSON.stringify({ labels: { eng: 'UNAOC', zzz: 'Nowhere' } })),
      url,
      langCodeMap
    )
    expect(entry.labels).toEqual({ en: 'UNAOC' })
  })

  it('emits empty maps for empty or non-map language fields', () => {
    const entry = buildLogoEntry(
      row(JSON.stringify({ labels: {}, alts: null, further_readings: 'nonsense' })),
      url,
      langCodeMap
    )
    expect(entry.labels).toEqual({})
    expect(entry.alt_texts).toEqual({})
    expect(entry.further_readings).toEqual({})
  })
})

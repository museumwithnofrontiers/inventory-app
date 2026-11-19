import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  loadCollectionRelations,
  withCollectionRelations,
  withTranslationRelations,
  type CollectionRelations,
} from '../../../shared/collection-relations.mjs'
import { COUNTRY_CODE_ALIASES, COUNTRY_CODE_MAP, legacyCountryCode } from '../../../shared/country-codes.mjs'

const relations = (over: Partial<CollectionRelations> = {}): CollectionRelations => ({
  contextId: 'x-explore',
  countries: [],
  links: {},
  cover: null,
  days: null,
  ...over,
})

const english = { collection_id: 'c1', language_id: 'eng', context_id: 'x-explore' }

describe('withTranslationRelations', () => {
  it('gives the English text in the own context its lists back, in MySQL JSON key order', () => {
    const extra = withTranslationRelations(
      { introd_type: 'L' },
      relations({
        countries: ['jor', 'pse'],
        links: {
          location: ['mwnf3_explore:location:10', 'mwnf3_explore:location:23'],
          territory: ['mwnf3_explore:region:6'],
        },
      }),
      english
    ) as Record<string, unknown>
    expect(Object.keys(extra)).toEqual(['country_ids', 'introd_type', 'location_ids', 'territory_ids'])
    expect(extra).toEqual({
      introd_type: 'L',
      country_ids: ['jo', 'pa'],
      location_ids: [10, 23],
      territory_ids: [6],
    })
  })

  it('leaves any other translation as it came', () => {
    const r = relations({ countries: ['jor'] })
    expect(withTranslationRelations(null, r, { ...english, language_id: 'spa' })).toBeNull()
    expect(withTranslationRelations(null, r, { ...english, context_id: 'other' })).toBeNull()
    expect(withTranslationRelations(null, undefined, english)).toBeNull()
  })

  it('gives a theme its region themes and a location its other regions', () => {
    expect(
      withTranslationRelations(
        null,
        relations({ links: { theme: ['mwnf3_explore:thematiccycle:3'], additional_region: ['mwnf3_explore:region:1'] } }),
        english
      )
    ).toEqual({ theme_ids: [3], additional_regions: [1] })
  })

  it('fails on a link legacy could not hold', () => {
    expect(() =>
      withTranslationRelations(null, relations({ links: { location: ['mwnf3:exhibitions:1'] } }), english)
    ).toThrow(/c1/)
  })
})

describe('withCollectionRelations', () => {
  it('gives the collection its background, cover picture and days back', () => {
    const extra = withCollectionRelations(
      { thg_gallery: { slug: 'x' } },
      relations({
        links: { historical_background: ['mwnf3_travels:location:IAM:tn:1:III:5'] },
        cover: { item_id: 'i1', backward_compatibility: 'mwnf3:objects_pictures:EXWIT:de:Mus61:4:1' },
        days: 2,
      })
    ) as Record<string, unknown>
    expect(Object.keys(extra)).toEqual(['days', 'thg_theme', 'thg_gallery', 'historical_background'])
    expect(extra['thg_theme']).toEqual({
      cover_picture: { item_id: 'i1', backward_compatibility: 'mwnf3:objects_pictures:EXWIT:de:Mus61:4:1' },
    })
    expect(Object.keys((extra['thg_theme'] as { cover_picture: object }).cover_picture)).toEqual([
      'item_id',
      'backward_compatibility',
    ])
  })

  it('leaves extra as it came without relations', () => {
    expect(withCollectionRelations(null, relations())).toBeNull()
    const extra = { b: 1 }
    expect(withCollectionRelations(extra, undefined)).toBe(extra)
  })
})

describe('loadCollectionRelations', () => {
  it('reads countries, links, cover and days by collection', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM collections c')) {
        return [
          { id: 'c1', context_id: 'x', cover_item_id: null, cover_backward_compatibility: null, days: 3 },
          { id: 'c2', context_id: 'x', cover_item_id: null, cover_backward_compatibility: null, days: null },
        ]
      }
      if (sql.includes('FROM collection_country')) return [{ collection_id: 'c1', country_id: 'jor' }]
      if (sql.includes('FROM collection_collection')) {
        return [{ collection_id: 'c1', kind: 'location', related_collection_id: 'l1', backward_compatibility: 'mwnf3_explore:location:9' }]
      }
      return []
    })
    const map = await loadCollectionRelations(query, ['c1', 'c2'])
    expect(map.get('c1')).toEqual({
      contextId: 'x',
      countries: ['jor'],
      links: { location: ['mwnf3_explore:location:9'] },
      cover: null,
      days: 3,
    })
    expect(map.has('c2')).toBe(false)
  })
})

describe('country codes', () => {
  const importerMap = readFileSync(
    fileURLToPath(new URL('../../../../importer/src/utils/code-mappings.ts', import.meta.url)),
    'utf8'
  )

  it('copies the importer map and its aliases exactly', () => {
    const block = importerMap.slice(importerMap.indexOf('export const COUNTRY_CODE_MAP'))
    const body = block.slice(0, block.indexOf('};'))
    const pairs = Object.fromEntries([...body.matchAll(/^\s+([a-z]{2}): '([a-z]{3})'/gm)].map(m => [m[1], m[2]]))
    expect(COUNTRY_CODE_MAP).toEqual(pairs)
    const aliases = importerMap.match(/COUNTRY_CODE_ALIASES: readonly string\[\] = \[([^\]]*)\]/)
    expect(aliases?.[1]?.match(/[a-z]{2}/g)).toEqual([...COUNTRY_CODE_ALIASES])
  })

  it('names as aliases the codes the importer map says map to the same as another', () => {
    const noted = [...importerMap.matchAll(/^\s+([a-z]{2}): '[a-z]{3}', \/\/.*maps to same as/gm)].map(m => m[1])
    expect(noted).toEqual([...COUNTRY_CODE_ALIASES])
  })

  it('gives each code in use back from its ISO3 id', () => {
    const inUse = ['ab', 'at', 'cz', 'de', 'dz', 'eg', 'es', 'hr', 'hu', 'it', 'jo', 'ma', 'pa', 'pt', 'sy', 'tn', 'tr']
    for (const code of inUse) expect(legacyCountryCode(COUNTRY_CODE_MAP[code]!)).toBe(code)
  })

  it('fails on an ISO3 id with no single code', () => {
    expect(() => legacyCountryCode('xxx')).toThrow(/xxx/)
    expect(() => legacyCountryCode('ita', { it: 'ita', ix: 'ita' }, [])).toThrow(/it, ix/)
    expect(legacyCountryCode('ita', { it: 'ita', ix: 'ita' }, ['ix'])).toBe('it')
  })
})

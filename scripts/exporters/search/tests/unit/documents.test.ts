import { describe, expect, it } from 'vitest'

import {
  SCHEMA,
  buildDocuments,
  shardDocuments,
  shardOf,
  stringsOf,
  type BuildInput,
  type ItemRow,
  type TranslationRow,
} from '../../src/core/documents.js'

const A = 'a1111111-1111-5111-8111-111111111111'
const B = 'b2222222-2222-5222-8222-222222222222'
const C = 'c3333333-3333-5333-8333-333333333333'
const OWN = 'own00000-0000-5000-8000-000000000000'
const OTHER = 'oth00000-0000-5000-8000-000000000000'

const item = (id: string, extra: Partial<ItemRow> = {}): ItemRow => ({
  id,
  type: 'object',
  parent_id: null,
  backward_compatibility: `mwnf3:objects:ISL:${id.slice(0, 4)}`,
  mwnf_reference: 'EG 12',
  owner_reference: 'Inv.no. 46/1980',
  start_date: 868,
  end_date: 905,
  partner_id: 'partner-1',
  country_id: 'egy',
  ...extra,
})

const tr = (itemId: string, language: string, extra: Partial<TranslationRow> = {}): TranslationRow => ({
  item_id: itemId,
  language,
  context_id: OWN,
  own_context_id: OWN,
  name: null,
  alternate_name: null,
  description: null,
  type: null,
  holder: null,
  owner: null,
  dates: null,
  location: null,
  place_of_production: null,
  provenance: null,
  extra: null,
  ...extra,
})

const input = (over: Partial<BuildInput> = {}): BuildInput => ({
  items: [item(A)],
  translations: [],
  tags: [],
  partners: [],
  countries: [],
  pictures: new Map(),
  sites: new Map([[A, [{ site: 'islamicart', path: `/item/${A}`, url: `https://x.test/islamicart/#/item/${A}` }]]]),
  baseUrl: 'https://inventory.example',
  ...over,
})

describe('buildDocuments', () => {
  it('carries the reference numbers, the picture and the sites as slug and route', () => {
    const { documents } = buildDocuments(input({ pictures: new Map([[A, 'abc.jpg']]) }))
    expect(documents).toHaveLength(1)
    const doc = documents[0]
    expect(doc.id).toBe(A)
    expect(doc.backward_compatibility).toBe('mwnf3:objects:ISL:a111')
    expect(doc.mwnf_reference).toBe('EG 12')
    expect(doc.owner_reference).toBe('Inv.no. 46/1980')
    expect(doc.picture).toBe('https://inventory.example/pub/abc.jpg')
    expect(doc.sites).toEqual([{ site: 'islamicart', path: `/item/${A}` }])
  })

  it('leaves out an item no site shows, and counts it', () => {
    const result = buildDocuments(input({ items: [item(A), item(B)] }))
    expect(result.documents.map(d => d.id)).toEqual([A])
    expect(result.excludedNoSite).toBe(1)
  })

  it("opens a detail with no page of its own on its monument's page", () => {
    const monument = item(A, { type: 'monument' })
    const detail = item(B, { type: 'detail', parent_id: A })
    const orphan = item(C, { type: 'detail', parent_id: null })
    const { documents, excludedNoSite } = buildDocuments(input({ items: [monument, detail, orphan] }))
    expect(documents.map(d => d.id)).toEqual([A, B])
    expect(documents[1].sites).toEqual([{ site: 'islamicart', path: `/item/${A}` }])
    expect(excludedNoSite).toBe(1)
  })

  it("names the item as its own project's context does, and keeps every other name", () => {
    const { documents } = buildDocuments(
      input({
        translations: [
          tr(A, 'en', { context_id: OTHER, name: 'Gallery title' }),
          tr(A, 'en', { context_id: OWN, name: 'Own title', alternate_name: 'Alias' }),
        ],
      })
    )
    const en = documents[0].texts['en']
    expect(en.name).toBe('Own title')
    expect(en.names).toEqual(['Gallery title', 'Alias'])
  })

  it('keeps descriptions and the descriptive extra fields, and leaves out credits and bibliography', () => {
    const { documents } = buildDocuments(
      input({
        translations: [
          tr(A, 'ar', {
            name: 'خمس قطع من النسيج.',
            description: 'خمس قطع من نسيج الصوف',
            location: 'القاهرة',
            extra: JSON.stringify({
              description2: 'تعدَّدت مصانع النسيج',
              keywords: 'زخرفة حيوانية؛ صوف',
              materials: ['صوف'],
              dynasty: 'العصر الطولوني',
              copyright: '© someone',
              photographer: 'Somebody',
              credits_as_written: 'author',
            }),
          }),
        ],
      })
    )
    const ar = documents[0].texts['ar']
    expect(ar.name).toBe('خمس قطع من النسيج.')
    expect(ar.description).toEqual(['خمس قطع من نسيج الصوف'])
    expect(ar.short_description).toEqual(['تعدَّدت مصانع النسيج'])
    expect(ar.keywords).toEqual(['زخرفة حيوانية؛ صوف'])
    expect(ar.materials).toEqual(['صوف'])
    expect(ar.dynasty).toEqual(['العصر الطولوني'])
    expect(ar.place).toEqual(['القاهرة'])
    expect(JSON.stringify(documents[0])).not.toContain('Somebody')
    expect(JSON.stringify(documents[0])).not.toContain('© someone')
  })

  it('puts a tag in its own language, and a tag of no language on the document', () => {
    const { documents } = buildDocuments(
      input({
        translations: [tr(A, 'en', { name: 'Bowl' }), tr(A, 'fr', { name: 'Coupe' })],
        tags: [
          { item_id: A, label: 'Lustre', language: 'en' },
          { item_id: A, label: 'Lustre métallique', language: 'fr' },
          { item_id: A, label: 'Fatimid', language: null },
          { item_id: A, label: 'Tag of a language the item lacks', language: 'de' },
        ],
      })
    )
    const doc = documents[0]
    expect(doc.texts['en'].tags).toEqual(['Lustre'])
    expect(doc.texts['fr'].tags).toEqual(['Lustre métallique'])
    expect(doc.tags).toEqual(['Fatimid'])
    expect(doc.languages).toEqual(['en', 'fr'])
  })

  it('names the partner and the country in each language', () => {
    const { documents } = buildDocuments(
      input({
        translations: [tr(A, 'en', { name: 'Bowl' }), tr(A, 'ar', { name: 'زبدية' })],
        partners: [
          { id: 'partner-1', language: 'en', name: 'Museum of Islamic Art' },
          { id: 'partner-1', language: 'ar', name: 'متحف الفن الإسلامي' },
        ],
        countries: [{ id: 'egy', language: 'ar', name: 'مصر' }],
      })
    )
    expect(documents[0].texts['en'].partner).toEqual(['Museum of Islamic Art'])
    expect(documents[0].texts['ar'].partner).toEqual(['متحف الفن الإسلامي'])
    expect(documents[0].texts['ar'].country).toBe('مصر')
    expect(documents[0].texts['en'].country).toBeNull()
  })

  it('gives the same documents whatever the row order of the items', () => {
    const sites = new Map(
      [A, B, C].map(id => [id, [{ site: 'explore', path: `/item/${id}`, url: '' }]])
    )
    const one = buildDocuments(input({ items: [item(C), item(A), item(B)], sites }))
    const two = buildDocuments(input({ items: [item(B), item(C), item(A)], sites }))
    expect(one.documents.map(d => d.id)).toEqual([A, B, C])
    expect(JSON.stringify(one)).toBe(JSON.stringify(two))
  })
})

describe('stringsOf', () => {
  it('flattens strings, arrays and objects, dropping blanks', () => {
    expect(stringsOf(' a ')).toEqual(['a'])
    expect(stringsOf(['a', '', ['b', { c: 'c' }], 3, null])).toEqual(['a', 'b', 'c'])
    expect(stringsOf(null)).toEqual([])
  })
})

describe('shardDocuments', () => {
  it('writes 16 shards by the first character of the id, one line per document', () => {
    const sites = new Map([A, B].map(id => [id, [{ site: 'explore', path: `/item/${id}`, url: '' }]]))
    const { documents } = buildDocuments(input({ items: [item(B), item(A)], sites }))
    const shards = shardDocuments(documents)
    expect([...shards.keys()]).toHaveLength(16)
    expect(shards.get('documents/a.ndjson')).toBe(JSON.stringify(documents[0]) + '\n')
    expect(shards.get('documents/b.ndjson')).toBe(JSON.stringify(documents[1]) + '\n')
    expect(shards.get('documents/0.ndjson')).toBe('')
  })

  it('refuses an id that is not a UUID', () => {
    expect(() => shardOf('zz')).toThrow()
  })

  it('declares the schema', () => {
    expect(SCHEMA).toBe('mwnf.search/1')
  })
})

import { describe, expect, it } from 'vitest'

import { namesByItem, resolveReferences } from '../../../shared/references.mjs'
import { publicationLinks, trailLinks } from '../../../shared/links.mjs'
import { SITES } from './support.js'

const row = (item_id: string, language: string, context_id: string, own: string | null, name: string | null) => ({
  item_id,
  language,
  context_id,
  own_context_id: own,
  name,
})

describe('namesByItem', () => {
  it("prefers the item's own project text in each language", () => {
    const names = namesByItem([
      row('a', 'en', 'epm', 'isl', 'EPM name'),
      row('a', 'en', 'isl', 'isl', 'ISL name'),
      row('a', 'fr', 'epm', 'isl', 'Nom EPM'),
      row('b', 'en', 'travels', null, '  '),
    ])
    expect(names.get('a')).toEqual({ en: 'ISL name', fr: 'Nom EPM' })
    expect(names.has('b')).toBe(false)
  })
})

describe('resolveReferences', () => {
  const query = async (sql: string) => {
    if (sql.includes('FROM items WHERE id IN') && sql.includes('backward_compatibility')) {
      return [{ id: 'o1', type: 'object', backward_compatibility: 'mwnf3:objects:ISL:jo:Mus01:1' }]
    }
    if (sql.includes('FROM items WHERE id IN')) return [{ id: 'o1', type: 'object', project_id: 'isl' }]
    if (sql.includes('FROM item_translations')) return [row('o1', 'en', 'isl', 'isl', 'Bowl')]
    if (sql.includes('FROM items pic')) {
      return [
        { item_id: 'o1', path: 'first.jpg' },
        { item_id: 'o1', path: 'second.jpg' },
      ]
    }
    return []
  }

  it('ships the name, the first picture and the sites, never the sheet', async () => {
    const refs = await resolveReferences(query, ['o1', 'missing', 'o1'], { baseUrl: 'https://inv.test', sites: SITES })
    expect(refs).toEqual([
      {
        id: 'o1',
        type: 'object',
        backward_compatibility: 'mwnf3:objects:ISL:jo:Mus01:1',
        names: { en: 'Bowl' },
        picture: 'https://inv.test/pub/first.jpg',
        sites: [{ site: 'islamicart', path: '/item/o1', url: 'https://example.test/islamicart/#/item/o1' }],
      },
    ])
  })

  it('links each site to the page that opens the item, and leaves out a mini-site', async () => {
    const collections = [
      { id: 'root-t', parent_id: null, type: 'collection', purpose: 'travels-root' },
      { id: 'trail', parent_id: 'root-t', type: 'exhibition trail', purpose: null },
      { id: 'itin', parent_id: 'trail', type: 'itinerary', purpose: null },
      { id: 'tloc', parent_id: 'itin', type: 'location', purpose: null },
      { id: 'mini', parent_id: null, type: 'exhibition', purpose: null },
    ]
    const monumentQuery = async (sql: string, params: unknown[] = []) => {
      if (sql.includes('FROM items WHERE id IN') && sql.includes('backward_compatibility')) {
        return [{ id: 'm1', type: 'monument', backward_compatibility: 'mwnf3_travels:monument:IAM:jo:1', parent_id: null }]
      }
      if (sql.includes('FROM items WHERE id IN')) return [{ id: 'm1', type: 'monument', project_id: null }]
      if (sql.includes('UNION ALL')) {
        return [
          { item_id: 'm1', collection_id: 'mini', via_picture: 0 },
          { item_id: 'm1', collection_id: 'tloc', via_picture: 0 },
        ]
      }
      if (sql.includes('FROM collections WHERE id IN')) return collections.filter(c => params.includes(c.id))
      if (sql.includes('FROM collections ORDER BY id')) return collections
      if (sql.includes('SELECT ci.item_id, ci.collection_id')) return [{ item_id: 'm1', collection_id: 'tloc' }]
      return []
    }
    const sites = [
      ...SITES,
      { slug: 'mini', kind: 'minisite', origin: 'https://example.test/mini', itemPath: '/item/:id', rule: { type: 'subtree' as const, collectionId: 'mini' } },
    ]
    const [ref] = await resolveReferences(monumentQuery, ['m1'], { baseUrl: 'https://inv.test', sites })
    expect(ref.sites).toEqual([
      { site: 'travels', path: '/itinerary/itin?tab=vl', url: 'https://example.test/travels/#/itinerary/itin?tab=vl' },
    ])
  })

  it('reads nothing for no item', async () => {
    expect(await resolveReferences(async () => { throw new Error('no query') }, [], { baseUrl: 'x', sites: SITES })).toEqual([])
  })
})

describe('publicationLinks and trailLinks', () => {
  const query = async (sql: string) => {
    if (sql.includes('FROM publications WHERE')) return [{ id: 'p1', backward_compatibility: 'mwnf3:bookbase:7' }]
    if (sql.includes('FROM publication_translations')) {
      return [
        { id: 'p1', language: 'en', title: 'Own title' },
        { id: 'p1', language: 'en', title: 'Other context' },
        { id: 'p1', language: 'ar', title: 'عنوان' },
      ]
    }
    if (sql.includes('FROM collections WHERE')) return [{ id: 't1', backward_compatibility: 'mwnf3_travels:trail:IAM:jo:1' }]
    if (sql.includes('FROM collection_translations')) {
      return [{ id: 't1', language: 'en', title: 'The Umayyads', extra: { subtitle: 'The Rise of Islamic Art' } }]
    }
    return []
  }

  it('links a publication to its Publications page', async () => {
    expect(await publicationLinks(query, ['p1', 'p2'], SITES)).toEqual([
      {
        id: 'p1',
        backward_compatibility: 'mwnf3:bookbase:7',
        titles: { ar: 'عنوان', en: 'Own title' },
        site: 'publications',
        path: '/publication/p1',
        url: 'https://example.test/publications/#/publication/p1',
      },
    ])
  })

  it('links a trail to its Travels page, with its subtitle', async () => {
    expect(await trailLinks(query, ['t1'], SITES)).toEqual([
      {
        id: 't1',
        backward_compatibility: 'mwnf3_travels:trail:IAM:jo:1',
        titles: { en: 'The Umayyads' },
        subtitles: { en: 'The Rise of Islamic Art' },
        site: 'travels',
        path: '/trail/t1',
        url: 'https://example.test/travels/#/trail/t1',
      },
    ])
  })
})

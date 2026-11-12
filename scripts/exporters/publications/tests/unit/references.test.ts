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

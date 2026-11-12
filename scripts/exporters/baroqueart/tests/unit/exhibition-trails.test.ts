import { describe, expect, it } from 'vitest'

import { trailsByItem, TRAVELS_CONTEXT_KEY } from '../../src/core/exhibition-trails.js'
import type { Site } from '../../../shared/sites.mjs'

/**
 * Legacy's "Related exhibition trails" (D4, #2538): the Travels trails an item
 * is an entry of, each linked to its page on the Travels site.
 */
describe('the exhibition trails of an item', () => {
  const sites: Site[] = [
    { slug: 'travels', kind: 'standalone', origin: 'https://example.test/travels', itemPath: '/item/:id', rule: null },
  ]

  it('links each trail the item is an entry of, titled as legacy titled it', async () => {
    const asked: (string | number | null)[][] = []
    const db = {
      query: async <T>(sql: string, params: (string | number | null)[] = []): Promise<T[]> => {
        asked.push(params)
        if (sql.includes("c.type = 'exhibition trail'")) return [{ item_id: 'o1', collection_id: 't1' }] as T[]
        if (sql.includes('FROM collections WHERE')) {
          return [{ id: 't1', backward_compatibility: 'mwnf3_travels:trail:IAM:pt:1' }] as T[]
        }
        if (sql.includes('FROM collection_translations')) {
          return [{ id: 't1', language: 'en', title: 'In Lands of the Christian Kings', extra: { subtitle: 'Mudejar Art' } }] as T[]
        }
        return []
      },
    }
    const trails = await trailsByItem(db, ['o1', 'o2'], sites)
    expect(asked[0]).toEqual([TRAVELS_CONTEXT_KEY, 'o1', 'o2'])
    expect(trails.get('o1')).toEqual([
      {
        id: 't1',
        backward_compatibility: 'mwnf3_travels:trail:IAM:pt:1',
        titles: { en: 'In Lands of the Christian Kings' },
        subtitles: { en: 'Mudejar Art' },
        site: 'travels',
        path: '/trail/t1',
        url: 'https://example.test/travels/#/trail/t1',
      },
    ])
    expect(trails.has('o2')).toBe(false)
  })

  it('reads nothing for no item', async () => {
    const db = { query: async () => { throw new Error('no query') } }
    expect((await trailsByItem(db, [], sites)).size).toBe(0)
  })
})

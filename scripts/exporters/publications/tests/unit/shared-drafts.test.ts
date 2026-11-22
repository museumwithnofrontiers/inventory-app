import { describe, expect, it } from 'vitest'

import { resolveReferences } from '../../../shared/references.mjs'
import { trailLinks } from '../../../shared/links.mjs'
import { loadCollectionRelations } from '../../../shared/collection-relations.mjs'
import { itemIdShipped, itemShipped, textShipped } from '../../../shared/drafts.mjs'
import { SITES } from './support.js'

/** The shared modules and drafts (M17 B3): no reference to a draft item or a draft trail. */
describe('drafts in the shared modules', () => {
  it('references no draft item, none of its pictures and no draft text', async () => {
    const asked: string[] = []
    const refs = await resolveReferences(
      async (sql: string) => {
        asked.push(sql)
        // The database leaves the draft out of the items it answers.
        if (sql.includes('FROM items WHERE id IN') && sql.includes('backward_compatibility')) {
          return [{ id: 'o1', type: 'object', backward_compatibility: 'mwnf3:objects:ISL:jo:Mus01:1', parent_id: null }]
        }
        return []
      },
      ['o1', 'draft'],
      { baseUrl: 'https://inv.test', sites: SITES }
    )
    expect(refs.map(r => r.id)).toEqual(['o1'])
    expect(asked.find(sql => sql.includes('backward_compatibility, parent_id FROM items'))).toContain(itemShipped('items'))
    expect(asked.find(sql => sql.includes('FROM item_translations it'))).toContain(textShipped('it'))
    expect(asked.find(sql => sql.includes('FROM items pic'))).toContain(itemShipped('pic'))
  })

  it('links no draft trail, nor one under a draft', async () => {
    const query = async (sql: string) => {
      if (sql.includes('SELECT id, parent_id, draft FROM collections')) {
        return [
          { id: 'root', parent_id: null, draft: 1 },
          { id: 't2', parent_id: 'root', draft: 0 },
          { id: 't1', parent_id: null, draft: 0 },
        ]
      }
      if (sql.includes('FROM collections WHERE')) return [{ id: 't1', backward_compatibility: 'mwnf3_travels:trail:IAM:jo:1' }]
      return []
    }
    expect((await trailLinks(query, ['t1', 't2'], SITES)).map(link => link.id)).toEqual(['t1'])
  })

  it('names no draft cover item', async () => {
    const asked: string[] = []
    await loadCollectionRelations(async (sql: string) => {
      asked.push(sql)
      return []
    }, ['c1'])
    expect(asked[0]).toContain(`CASE WHEN i.id IS NOT NULL AND NOT ${itemShipped('i')} THEN NULL ELSE c.cover_item_id END`)
    // The reference helper: null, unknown or shipped passes.
    expect(itemIdShipped('c.cover_item_id', 'x')).toContain('x.id = c.cover_item_id')
  })
})

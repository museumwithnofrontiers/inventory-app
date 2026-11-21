import { describe, expect, it } from 'vitest'

import { resolveScope } from '../../src/core/scope.js'
import type { Database } from '../../src/core/database.js'
import { itemShipped, textShipped } from '../../../shared/drafts.mjs'

const collection = (id: string, parentId: string | null, type: string, purpose: string | null = null) => ({
  id,
  parent_id: parentId,
  type,
  purpose,
  display_order: null,
  internal_name: id,
  extra: null,
  english_extra: null,
})

describe('drafts in the Explore scope (M17 B3)', () => {
  it('leaves out a draft collection and its subtree, and asks only for shipped items and texts', async () => {
    const asked: string[] = []
    const db = {
      query: async (sql: string) => {
        asked.push(sql)
        if (sql.includes('FROM contexts')) return [{ id: 'explore-context' }]
        if (sql.includes('SELECT id, parent_id, draft FROM collections')) {
          return [
            { id: 'root', parent_id: null, draft: 0 },
            { id: 'country', parent_id: 'root', draft: 1 },
            { id: 'draft-loc', parent_id: 'country', draft: 0 },
            { id: 'loc', parent_id: 'root', draft: 0 },
          ]
        }
        if (sql.includes('FROM collections c')) {
          return [
            collection('root', null, 'collection', 'explore-root'),
            collection('country', 'root', 'country'),
            collection('draft-loc', 'country', 'location'),
            collection('loc', 'root', 'location'),
          ]
        }
        if (sql.includes('FROM collection_item ci')) return [{ id: 'monument', project_id: 'bar' }]
        if (sql.includes('FROM item_translations')) return [{ context_id: 'bar-context' }]
        return []
      },
    } as unknown as Database

    const scope = await resolveScope(db)

    expect(scope.collectionIds).toEqual(['root', 'loc'])
    const members = asked.find(sql => sql.includes('FROM collection_item ci'))
    expect(members).toContain(itemShipped('i'))
    expect(asked.find(sql => sql.includes("type = 'detail'"))).toContain(itemShipped('items'))
    expect(asked.find(sql => sql.includes('FROM item_item_links'))).toContain(itemShipped('i'))
    expect(asked.find(sql => sql.includes('SELECT DISTINCT context_id FROM item_translations'))).toContain(
      textShipped('item_translations')
    )
  })
})

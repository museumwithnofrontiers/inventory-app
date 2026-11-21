import { describe, expect, it } from 'vitest'

import type { Database } from '../../src/core/database.js'
import { resolveScope } from '../../src/core/scope.js'
import { itemShipped } from '../../../shared/drafts.mjs'

type Params = (string | number | null)[]
function fakeDb(answer: (sql: string, params: Params) => unknown[] | undefined): Database {
  return { query: async (sql: string, params: Params = []) => answer(sql, params) ?? [] } as unknown as Database
}

const tree = [
  { id: 'root', parent_id: null, type: 'collection', purpose: 'travels-root', display_order: 1, internal_name: 'root', draft: 0 },
  { id: 'trail-a', parent_id: 'root', type: 'exhibition trail', purpose: null, display_order: 1, internal_name: 'a', draft: 0 },
  { id: 'trail-b', parent_id: 'root', type: 'exhibition trail', purpose: null, display_order: 2, internal_name: 'b', draft: 1 },
  { id: 'itinerary', parent_id: 'trail-b', type: 'itinerary', purpose: null, display_order: 1, internal_name: 'i', draft: 0 },
  { id: 'location', parent_id: 'itinerary', type: 'location', purpose: null, display_order: 1, internal_name: 'l', draft: 0 },
]

describe('drafts in the Travels scope (M17 B3)', () => {
  it('leaves out a draft trail and everything under it, and asks only for shipped items', async () => {
    const asked: string[] = []
    const db = fakeDb((sql, params) => {
      asked.push(sql)
      if (sql.includes('FROM contexts')) return [{ id: 'travels-context' }]
      if (sql.includes('FROM collections')) return tree
      if (sql.includes('FROM collection_item') && params.includes('trail-a')) {
        return [{ collection_id: 'trail-a', item_id: 'isl-object' }]
      }
      return undefined
    })
    const scope = await resolveScope(db)
    expect(scope.collectionIds).toEqual(['root', 'trail-a'])
    expect(scope.trailIds).toEqual(['trail-a'])
    // The draft trail's location is gone, so no member is asked for.
    expect(scope.itemIds).toEqual([])
    const entries = asked.find(sql => sql.includes('FROM collection_item') && sql.includes("i.type IN ('object', 'monument')"))
    expect(entries).toContain(itemShipped('i'))
  })
})

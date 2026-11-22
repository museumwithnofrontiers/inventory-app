import { describe, expect, it } from 'vitest'

import type { Database } from '../../src/core/database.js'
import { resolveScope } from '../../src/core/scope.js'
import { itemIdShipped, itemShipped } from '../../../shared/drafts.mjs'

describe('drafts in the Publications scope (M17 B3)', () => {
  it('leaves out a draft trail, and asks only for shipped catalogue items and trail entries', async () => {
    const asked: string[] = []
    const answers: [string, unknown[]][] = [
      ['draft FROM collections', [{ id: 't2', parent_id: null, draft: 1 }]],
      ['FROM publications', [{ id: 'p1', project_id: null }]],
      ['FROM publication_collection', [{ key: 'p1', value: 't1' }, { key: 'p1', value: 't2' }]],
      ['FROM publication_item', [{ key: 'p1', value: 'm9' }]],
      ['FROM collection_item', [{ key: 't1', value: 'o1' }]],
    ]
    const db = {
      query: async (sql: string) => {
        asked.push(sql)
        for (const [fragment, rows] of answers) if (sql.includes(fragment)) return rows
        return []
      },
    } as unknown as Database

    const scope = await resolveScope(db)
    expect(scope.trailIds).toEqual(['t1'])
    expect(scope.trailsByPublication.get('p1')).toEqual(['t1'])
    expect(asked.find(sql => sql.includes('FROM publication_item'))).toContain(
      itemIdShipped('publication_item.item_id', 'dr_catalogue')
    )
    expect(asked.find(sql => sql.includes('FROM collection_item'))).toContain(itemShipped('i'))
  })
})

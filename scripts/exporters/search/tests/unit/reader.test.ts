import { describe, expect, it } from 'vitest'

import { readInput } from '../../src/core/reader.js'
import { itemShipped, textShipped } from '../../../shared/drafts.mjs'

describe('readInput and drafts (M17 B3)', () => {
  it('leaves draft items, their pictures and draft texts out of the payload', async () => {
    const asked: string[] = []
    const query = async (sql: string) => {
      asked.push(sql)
      if (sql.includes('FROM items WHERE type IN')) {
        return [{ id: 'monument', type: 'monument', parent_id: null }]
      }
      return []
    }
    await readInput(query, [], 'https://example.test')

    expect(asked.find(sql => sql.includes('FROM items WHERE type IN'))).toContain(itemShipped('items'))
    expect(asked.find(sql => sql.includes('FROM item_translations it'))).toContain(textShipped('it'))
    expect(asked.find(sql => sql.includes('FROM items pic'))).toContain(itemShipped('pic'))
  })
})

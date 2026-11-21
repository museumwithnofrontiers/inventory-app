import { describe, expect, it, vi } from 'vitest'

import { Database } from '../../src/core/database.js'
import { itemShipped } from '../../../shared/drafts.mjs'

const theme = (id: string, parentId: string, over: Record<string, unknown> = {}) => ({
  id,
  internal_name: id,
  backward_compatibility: `mwnf3_thematic_gallery:theme:47:${id}`,
  display_order: 1,
  parent_id: parentId,
  extra: null,
  draft: 0,
  ...over,
})

describe('drafts in the exhibition scope (M17 B3)', () => {
  it('asks only for shipped members', async () => {
    const db = new Database()
    const query = vi.spyOn(db, 'query').mockResolvedValue([])
    await db.resolveMembers('exhibition-uuid')
    expect(query.mock.calls[0]?.[0]).toContain(itemShipped('i'))
  })

  it('refuses a draft exhibition: it ships nowhere', async () => {
    const db = new Database()
    vi.spyOn(db, 'query').mockResolvedValueOnce([
      { id: 'exhibition-uuid', backward_compatibility: 'mwnf3_thematic_gallery:thg_gallery:47', type: 'exhibition', draft: 1, extra: null },
    ])
    await expect(db.resolveExhibition('exhibition-uuid')).rejects.toThrow(/draft/)
  })

  it('leaves out a draft theme with its sub-themes', async () => {
    const db = new Database()
    const query = vi.spyOn(db, 'query').mockResolvedValue([
      theme('kept', 'exhibition-uuid'),
      theme('draft', 'exhibition-uuid', { draft: 1 }),
      theme('under-draft', 'draft'),
      theme('sub', 'kept'),
    ])
    const themes = await db.resolveThemes('exhibition-uuid')
    expect(themes.map(t => t.id)).toEqual(['kept', 'sub'])
    expect(query.mock.calls[0]?.[0]).toContain('c.draft')
  })
})

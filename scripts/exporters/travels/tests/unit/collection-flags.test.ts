import { describe, expect, it, vi } from 'vitest'
import {
  loadCollectionFlags,
  restoreCollectionFlags,
  withCollectionFlags,
  type CollectionFlags,
} from '../../../shared/collection-flags.mjs'

const flags = (over: Partial<CollectionFlags> = {}): CollectionFlags => ({
  draft: false,
  contextId: 'x1',
  backwardCompatibility: 'mwnf3:exhibitions:1',
  ...over,
})

describe('withCollectionFlags', () => {
  it("gives a draft exhibition's text its show flag back (n), in MySQL JSON key order", () => {
    const extra = withCollectionFlags(
      { legacy_exhibition: { project_id: 'ISL', new_status: 'N' } },
      flags({ draft: true })
    ) as Record<string, Record<string, unknown>>
    expect(extra['legacy_exhibition']).toEqual({ show: 'n', new_status: 'N', project_id: 'ISL' })
    expect(Object.keys(extra['legacy_exhibition']!)).toEqual(['show', 'new_status', 'project_id'])
    expect(withCollectionFlags({ legacy_exhibition: { project_id: 'ISL' } }, flags())).toEqual({
      legacy_exhibition: { show: 'y', project_id: 'ISL' },
    })
  })

  it("leaves a gallery text's thg_gallery block alone: featured and live_date come from the instance file (M17 A2)", () => {
    const extra = { thg_gallery: { image: 'a.jpg', featured: 'A', live_date: '2026-03-24T00:00:00.000Z' } }
    expect(withCollectionFlags(extra, flags())).toBe(extra)
    expect(withCollectionFlags({ thg_gallery: { image: 'a.jpg' } }, flags())).toEqual({ thg_gallery: { image: 'a.jpg' } })
  })

  it("gives an Explore theme's English text in its own context its status back", () => {
    const theme = flags({ draft: true, backwardCompatibility: 'mwnf3_explore:thematiccycle:3' })
    expect(withCollectionFlags(null, theme, { language_id: 'eng', context_id: 'x1' })).toEqual({ legacy_status: 'i' })
    expect(withCollectionFlags(null, { ...theme, draft: false }, { language_id: 'eng', context_id: 'x1' })).toEqual({
      legacy_status: 'e',
    })
    expect(withCollectionFlags(null, theme, { language_id: 'spa', context_id: 'x1' })).toBeNull()
    expect(withCollectionFlags(null, theme, { language_id: 'eng', context_id: 'other' })).toBeNull()
  })

  it('leaves a flag the text still holds and a text with no block as it came', () => {
    const kept = { legacy_exhibition: { show: 'n', project_id: 'ISL' } }
    expect(withCollectionFlags(kept, flags())).toBe(kept)
    expect(withCollectionFlags({ duration: 'One day' }, flags())).toEqual({ duration: 'One day' })
    expect(withCollectionFlags(null, undefined)).toBeNull()
  })
})

describe('loadCollectionFlags and restoreCollectionFlags', () => {
  it('reads draft as a number or a boolean and restores each row', async () => {
    const query = vi.fn(async () => [{ id: 'c1', draft: 1, context_id: 'x1', backward_compatibility: null }])
    expect((await loadCollectionFlags(query, ['c1'])).get('c1')).toEqual({
      draft: true,
      contextId: 'x1',
      backwardCompatibility: null,
    })
    expect(String((query.mock.calls[0] as unknown[])[0])).toMatch(/SELECT id, draft, context_id, backward_compatibility/)
    const rows = await restoreCollectionFlags(query, [
      { collection_id: 'c1', extra: { legacy_exhibition: { project_id: 'ISL' } } },
    ])
    expect(rows[0]!.extra).toEqual({ legacy_exhibition: { show: 'n', project_id: 'ISL' } })
  })
})

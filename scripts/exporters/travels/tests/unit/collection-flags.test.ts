import { describe, expect, it, vi } from 'vitest'
import {
  loadCollectionFlags,
  restoreCollectionFlags,
  withCollectionFlags,
  type CollectionFlags,
} from '../../../shared/collection-flags.mjs'

const flags = (over: Partial<CollectionFlags> = {}): CollectionFlags => ({
  visible: true,
  featured: false,
  publishedAt: null,
  contextId: 'x1',
  backwardCompatibility: 'mwnf3:exhibitions:1',
  ...over,
})

describe('withCollectionFlags', () => {
  it('gives an exhibition text its show flag back, in MySQL JSON key order', () => {
    const extra = withCollectionFlags(
      { legacy_exhibition: { project_id: 'ISL', new_status: 'N' } },
      flags({ visible: false })
    ) as Record<string, Record<string, unknown>>
    expect(extra['legacy_exhibition']).toEqual({ show: 'n', new_status: 'N', project_id: 'ISL' })
    expect(Object.keys(extra['legacy_exhibition']!)).toEqual(['show', 'new_status', 'project_id'])
  })

  it("gives a gallery text its featured flag and live date back", () => {
    expect(
      withCollectionFlags({ thg_gallery: { image: 'a.jpg' } }, flags({ featured: true, publishedAt: '2026-03-24' }))
    ).toEqual({ thg_gallery: { image: 'a.jpg', featured: 'A', live_date: '2026-03-24T00:00:00.000Z' } })
    expect(withCollectionFlags({ thg_gallery: { image: 'a.jpg' } }, flags())).toEqual({
      thg_gallery: { image: 'a.jpg', featured: 'H' },
    })
  })

  it("gives an Explore theme's English text in its own context its status back", () => {
    const theme = flags({ visible: false, backwardCompatibility: 'mwnf3_explore:thematiccycle:3' })
    expect(withCollectionFlags(null, theme, { language_id: 'eng', context_id: 'x1' })).toEqual({ legacy_status: 'i' })
    expect(withCollectionFlags(null, theme, { language_id: 'spa', context_id: 'x1' })).toBeNull()
    expect(withCollectionFlags(null, theme, { language_id: 'eng', context_id: 'other' })).toBeNull()
  })

  it('leaves a flag the text still holds and a text with no block as it came', () => {
    const kept = { legacy_exhibition: { show: 'n', project_id: 'ISL' } }
    expect(withCollectionFlags(kept, flags({ visible: true }))).toBe(kept)
    expect(withCollectionFlags({ duration: 'One day' }, flags())).toEqual({ duration: 'One day' })
    expect(withCollectionFlags(null, undefined)).toBeNull()
  })
})

describe('loadCollectionFlags and restoreCollectionFlags', () => {
  it('reads the flags as numbers or booleans and restores each row', async () => {
    const query = vi.fn(async () => [
      { id: 'c1', visible: 0, featured: 1, published_at: '2026-03-24', context_id: 'x1', backward_compatibility: null },
    ])
    expect((await loadCollectionFlags(query, ['c1'])).get('c1')).toEqual({
      visible: false,
      featured: true,
      publishedAt: '2026-03-24',
      contextId: 'x1',
      backwardCompatibility: null,
    })
    const rows = await restoreCollectionFlags(query, [
      { collection_id: 'c1', extra: { legacy_exhibition: { project_id: 'ISL' } } },
    ])
    expect(rows[0]!.extra).toEqual({ legacy_exhibition: { show: 'n', project_id: 'ISL' } })
  })
})

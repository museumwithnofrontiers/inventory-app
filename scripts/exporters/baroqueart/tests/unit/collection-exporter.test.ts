import { describe, expect, it } from 'vitest'

import {
  buildCollectionItemEntry,
  computeUnpublishedExhibitionSubtree,
  groupDetailViews,
} from '../../src/exporters/collection-exporter.js'

/**
 * The legacy site only listed exhibitions with mwnf3.exhibitions.show='y';
 * the importer preserves the flag in collection_translations
 * extra.legacy_exhibition.show. The exporter must drop show='n' exhibitions
 * and their whole theme/page subtree from the package (e.g. BAR exhibition 49
 * "Academia, Universities, Sciences", which has themes but no content).
 */
describe('computeUnpublishedExhibitionSubtree', () => {
  const collections = [
    { id: 'root', parent_id: null },
    { id: 'exh-published', parent_id: 'root' },
    { id: 'exh-unpublished', parent_id: 'root' },
    { id: 'theme-1', parent_id: 'exh-unpublished' },
    { id: 'theme-2', parent_id: 'exh-unpublished' },
    { id: 'page-1', parent_id: 'theme-1' },
    { id: 'theme-published', parent_id: 'exh-published' },
  ]

  it('excludes a show=n exhibition and all its descendants', () => {
    const translations = [
      { collection_id: 'exh-published', extra: { legacy_exhibition: { show: 'y' } } },
      { collection_id: 'exh-unpublished', extra: { legacy_exhibition: { show: 'n' } } },
    ]
    const excluded = computeUnpublishedExhibitionSubtree(collections, translations)
    expect([...excluded].sort()).toEqual(['exh-unpublished', 'page-1', 'theme-1', 'theme-2'])
  })

  it('excludes nothing when every exhibition is published', () => {
    const translations = [
      { collection_id: 'exh-published', extra: { legacy_exhibition: { show: 'y' } } },
      { collection_id: 'exh-unpublished', extra: null },
    ]
    expect(computeUnpublishedExhibitionSubtree(collections, translations).size).toBe(0)
  })

  it('handles extra delivered as a JSON string (defensive mysql2 path)', () => {
    const translations = [
      {
        collection_id: 'exh-unpublished',
        extra: JSON.stringify({ legacy_exhibition: { show: 'n' } }),
      },
    ]
    const excluded = computeUnpublishedExhibitionSubtree(collections, translations)
    expect(excluded.has('exh-unpublished')).toBe(true)
    expect(excluded.has('theme-1')).toBe(true)
  })

  it('ignores translations without legacy_exhibition metadata', () => {
    const translations = [
      { collection_id: 'exh-published', extra: { intro_header: 'Hello' } },
      { collection_id: 'root', extra: null },
    ]
    expect(computeUnpublishedExhibitionSubtree(collections, translations).size).toBe(0)
  })
})

/**
 * An exhibition placement links the picture child item legacy showed; the
 * query hands its parent item and that picture's image path to the entry.
 */
describe('buildCollectionItemEntry', () => {
  const url = (path: string) => `https://example.org/pub/${path}`

  it("carries the image of the picture the placement shows", () => {
    const entry = buildCollectionItemEntry(
      { collection_id: 'page', item_id: 'item', display_order: 1, extra: { n: 1, n2: 2 }, picture_path: 'abc.jpg' },
      url
    )
    expect(entry).toMatchObject({ id: 'item', display_order: 1, variant_order: 2, image_url: 'https://example.org/pub/abc.jpg' })
  })

  it('carries no image when the placement links the item itself', () => {
    const entry = buildCollectionItemEntry(
      { collection_id: 'page', item_id: 'item', display_order: 1, extra: { n: 1, n2: 1 }, picture_path: null },
      url
    )
    expect(entry).not.toHaveProperty('image_url')
  })

  it('ships its detail views as details, each with its image and caption', () => {
    const entry = buildCollectionItemEntry(
      { collection_id: 'page', item_id: 'monument', display_order: 4, extra: { n: 4, n2: 2 }, picture_path: null },
      url,
      [
        { collection_id: 'page', extra: { n: 4, n2: 2, parent_n2: 2, item_name: { en: 'High altar' } }, picture_path: 'd1.jpg' },
        { collection_id: 'page', extra: { n: 4, n2: 3, parent_n2: 2 }, picture_path: null },
      ]
    )
    expect(entry.details).toEqual([
      { image_url: 'https://example.org/pub/d1.jpg', caption: { en: { name: 'High altar' } } },
      { image_url: null },
    ])
  })

  it('has no details without detail views', () => {
    const entry = buildCollectionItemEntry(
      { collection_id: 'page', item_id: 'item', display_order: 1, extra: { n: 1, n2: 1 }, picture_path: null },
      url
    )
    expect(entry).not.toHaveProperty('details')
  })

  it('carries the artist and material lines Baroque Art captions print', () => {
    const entry = buildCollectionItemEntry(
      {
        collection_id: 'page',
        item_id: 'item',
        display_order: 1,
        extra: { n: 1, n2: 1, item_artist: { en: 'Andrea Pozzo' }, item_material: { en: 'Fresco' } },
        picture_path: null,
      },
      url
    )
    expect(entry.caption).toEqual({ en: { artist: 'Andrea Pozzo', material: 'Fresco' } })
  })
})

describe('groupDetailViews', () => {
  it('groups views by page, position and the n2 of the placement they belong to, in order', () => {
    const views = [
      { collection_id: 'page', extra: { n: 4, n2: 2, parent_n2: 2 }, picture_path: 'a.jpg' },
      { collection_id: 'page', extra: { n: 4, n2: 3, parent_n2: 2 }, picture_path: 'b.jpg' },
      { collection_id: 'page', extra: { n: 4, n2: 1, parent_n2: 1 }, picture_path: 'c.jpg' },
      { collection_id: 'other', extra: { n: 4, n2: 2, parent_n2: 2 }, picture_path: 'd.jpg' },
    ]
    const groups = groupDetailViews(views)
    expect(groups.get('page|4|2')?.map(v => v.picture_path)).toEqual(['a.jpg', 'b.jpg'])
    expect(groups.get('page|4|1')?.map(v => v.picture_path)).toEqual(['c.jpg'])
    expect(groups.get('other|4|2')?.map(v => v.picture_path)).toEqual(['d.jpg'])
  })
})
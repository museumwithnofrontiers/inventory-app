import { describe, expect, it } from 'vitest'

import { computeUnpublishedExhibitionSubtree } from '../../src/exporters/collection-exporter.js'

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

import { describe, expect, it } from 'vitest'

import { barePlacements, computeUnpublishedExhibitionSubtree, minisiteCollections } from '../../src/exporters/collection-exporter.js'

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
 * An exhibition that is a mini-site of its own keeps in this site's package
 * only its titles and which items it places (inventory-app#2359); its
 * National Context collections are this site's pages and stay whole.
 */
describe('minisiteCollections', () => {
  const collections = [
    { id: 'root', parent_id: null, purpose: 'exhibitions-root' },
    { id: 'exh-a', parent_id: 'root', purpose: null },
    { id: 'exh-b', parent_id: 'root', purpose: null },
    { id: 'theme-a1', parent_id: 'exh-a', purpose: null },
    { id: 'sub-a1', parent_id: 'theme-a1', purpose: null },
    { id: 'nc-a', parent_id: 'exh-a', purpose: 'national-context' },
    { id: 'nc-a-page', parent_id: 'nc-a', purpose: null },
    { id: 'theme-b1', parent_id: 'exh-b', purpose: null },
  ]

  it('takes the mini-site exhibitions, their themes and subthemes, never a National Context', () => {
    expect([...minisiteCollections(collections, ['exh-a'])].sort()).toEqual(['exh-a', 'sub-a1', 'theme-a1'])
  })

  it('ignores a mini-site whose exhibition is not in the package', () => {
    expect(minisiteCollections(collections, ['missing']).size).toBe(0)
  })
})

describe('barePlacements', () => {
  it('keeps each item once, at its first position, with nothing but its order', () => {
    const entries = [
      { id: 'i1', display_order: 1, variant_order: 1, image_url: 'a.jpg', justifications: { en: { partner: 'p', curator: null } } },
      { id: 'i1', display_order: 1, variant_order: 2, image_url: 'b.jpg' },
      { id: 'i2', display_order: 2, variant_order: null, curator_status: 'Y' },
    ]
    expect(barePlacements(entries)).toEqual([
      { id: 'i1', display_order: 1, variant_order: null },
      { id: 'i2', display_order: 2, variant_order: null },
    ])
  })
})

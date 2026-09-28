import { describe, expect, it } from 'vitest'

import { isShown, resolveScope, shippedTree, type TreeCollection } from '../../src/core/scope.js'
import type { Database } from '../../src/core/database.js'

const collection = (
  id: string,
  parent_id: string | null,
  type: string,
  fields: Partial<TreeCollection> = {}
): TreeCollection => ({
  id,
  parent_id,
  type,
  purpose: null,
  display_order: null,
  internal_name: id,
  extra: null,
  english_extra: null,
  ...fields,
})

const itineraryRoot = collection('itineraries', 'root', 'itinerary', {
  purpose: 'explore-itineraries-root',
})
const itinerary = (id: string, legacyType: string, fields: Partial<TreeCollection> = {}) =>
  collection(id, 'itineraries', 'itinerary', {
    extra: { explore_itinerary: { type: legacyType, order: 1, location_home_link: 'N' } },
    ...fields,
  })

describe('isShown', () => {
  it('shows a theme only when legacy marks it live', () => {
    expect(
      isShown(collection('t1', 'themes', 'theme', { english_extra: { legacy_status: 'e' } }), null)
    ).toBe(true)
    expect(
      isShown(collection('t9', 'themes', 'theme', { english_extra: { legacy_status: 'h' } }), null)
    ).toBe(false)
  })

  it('shows a thematic itinerary, and a location route only when it has a location', () => {
    expect(isShown(itinerary('1', '4'), itineraryRoot)).toBe(true)
    expect(
      isShown(itinerary('113', '1', { english_extra: { location_ids: [409] } }), itineraryRoot)
    ).toBe(true)
    expect(isShown(itinerary('141', '3'), itineraryRoot)).toBe(false)
  })

  it('shows every sub-itinerary of a shown itinerary', () => {
    const trail = collection('3', '1', 'exhibition trail', {
      extra: { explore_itinerary: { type: '4', order: 2, location_home_link: 'N' } },
    })
    expect(isShown(trail, itinerary('1', '4'))).toBe(true)
  })

  it("leaves out the old site's itineraries, but not the itineraries root", () => {
    expect(
      isShown(collection('old-16', 'loc', 'itinerary'), collection('loc', 'x', 'location'))
    ).toBe(false)
    expect(isShown(itineraryRoot, collection('root', null, 'collection'))).toBe(true)
  })
})

describe('shippedTree', () => {
  it('ships the root and what legacy shows under it, parents first, in display order', () => {
    const tree = shippedTree('root', [
      collection('root', null, 'collection', { purpose: 'explore-root' }),
      collection('countries', 'root', 'collection', { display_order: 2 }),
      collection('themes', 'root', 'collection', { display_order: 1 }),
      collection('t1', 'themes', 'theme', { english_extra: { legacy_status: 'e' } }),
      collection('t9', 'themes', 'theme'),
      collection('at', 'countries', 'collection'),
      collection('orphan', null, 'itinerary'),
    ])

    expect(tree.map(c => c.id)).toEqual(['root', 'themes', 'countries', 't1', 'at'])
  })

  it('hides the subtree of a hidden collection', () => {
    const tree = shippedTree('root', [
      collection('root', null, 'collection'),
      itineraryRoot,
      itinerary('141', '3'),
      collection('child', '141', 'exhibition trail', {
        extra: { explore_itinerary: { type: '4', order: 1, location_home_link: 'N' } },
      }),
    ])

    expect(tree.map(c => c.id)).toEqual(['root', 'itineraries'])
  })
})

describe('resolveScope', () => {
  it("ships the tree's members, their details and the records they link to", async () => {
    const db = {
      query: async (sql: string) => {
        if (sql.includes('FROM contexts')) return [{ id: 'explore-context' }]
        if (sql.includes('FROM collections c')) {
          return [
            {
              id: 'root',
              parent_id: null,
              type: 'collection',
              purpose: 'explore-root',
              display_order: null,
              internal_name: 'explore',
              extra: null,
              english_extra: null,
            },
            {
              id: 'loc',
              parent_id: 'root',
              type: 'location',
              purpose: null,
              display_order: null,
              internal_name: 'loc',
              extra: null,
              english_extra: null,
            },
          ]
        }
        if (sql.includes('FROM collection_item ci')) return [{ id: 'monument', project_id: 'bar' }]
        if (sql.includes("type = 'detail'")) return [{ id: 'detail', project_id: 'bar' }]
        if (sql.includes('FROM item_item_links')) return [{ id: 'object', project_id: 'isl' }]
        if (sql.includes('FROM item_translations'))
          return [{ context_id: 'bar-context' }, { context_id: 'explore-context' }]
        return []
      },
    } as unknown as Database

    const scope = await resolveScope(db)

    expect(scope.collectionIds).toEqual(['root', 'loc'])
    expect(scope.itemIds).toEqual(['detail', 'monument', 'object'])
    expect(scope.projectIds).toEqual(['bar', 'isl'])
    expect(scope.contextIds).toEqual(['explore-context', 'bar-context'])
  })
})

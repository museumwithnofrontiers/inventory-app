import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { CollectionExporter } from '../../src/exporters/collection-exporter.js'
import type { Database } from '../../src/core/database.js'
import { contextWith, scopeWith } from './support.js'

/**
 * Explore keeps its structure in `extra`: the site records on the root,
 * `historical_background` on a location, `explore_monument_ids` on a
 * location's membership. collections.json ships them as they are, in the
 * tree order the scope resolved.
 */
describe('CollectionExporter', () => {
  let outputDir: string

  const collection = (id: string, parent_id: string | null, type: string, extra: unknown) => ({
    id,
    type,
    purpose: parent_id ? null : 'explore-root',
    internal_name: id,
    backward_compatibility: `mwnf3_explore:${id}`,
    parent_id,
    display_order: null,
    country_id: null,
    latitude: '47.268735',
    longitude: null,
    map_zoom: 15,
    extra,
  })

  const db = {
    query: async (sql: string) => {
      if (sql.includes('FROM languages')) return [{ id: 'eng', backward_compatibility: 'en' }]
      if (sql.includes('FROM collections')) {
        // The database's order, not the tree's.
        return [
          collection('loc', 'root', 'location', {
            historical_background: ['mwnf3_travels:location:IAM:jo:1:V:1'],
          }),
          collection('root', null, 'collection', { explore_home: { banners: [] } }),
        ]
      }
      if (sql.includes('FROM collection_translations')) {
        return [
          {
            collection_id: 'loc',
            language_id: 'eng',
            title: 'Innsbruck',
            description: null,
            quote: null,
            url: null,
            extra: { showOnMonument: true },
          },
        ]
      }
      if (sql.includes('FROM collection_images')) return []
      if (sql.includes('FROM collection_item')) {
        return [
          {
            collection_id: 'loc',
            item_id: 'item-1',
            display_order: null,
            extra: { explore_monument_ids: [1501] },
          },
        ]
      }
      return []
    },
  } as unknown as Database

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'explore-collections-'))
  })

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true })
  })

  it("ships the tree in the scope's order, with Explore's extra on collections and memberships", async () => {
    const result = await new CollectionExporter(
      contextWith(db, outputDir, scopeWith({ collectionIds: ['root', 'loc'], itemIds: ['item-1'] }))
    ).export()

    expect(result.count).toBe(2)
    const output = JSON.parse(readFileSync(join(outputDir, 'collections.json'), 'utf-8'))
    expect(output.map((c: { id: string }) => c.id)).toEqual(['root', 'loc'])
    expect(output[0].extra).toEqual({ explore_home: { banners: [] } })
    expect(output[1]).toMatchObject({
      map_zoom: 15,
      latitude: 47.268735,
      extra: { historical_background: ['mwnf3_travels:location:IAM:jo:1:V:1'] },
      items: [{ id: 'item-1', display_order: null, extra: { explore_monument_ids: [1501] } }],
    })

    const english = JSON.parse(
      readFileSync(join(outputDir, 'translations', 'collections.en.json'), 'utf-8')
    )
    expect(english).toEqual({ loc: { title: 'Innsbruck', extra: { showOnMonument: true } } })
  })
})

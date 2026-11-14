import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Database } from '../../src/core/database.js'
import { resolveScope, shippedTree } from '../../src/core/scope.js'
import { CollectionExporter } from '../../src/exporters/collection-exporter.js'
import { ItemExporter } from '../../src/exporters/item-exporter.js'
import { ManifestExporter } from '../../src/exporters/manifest-exporter.js'
import { contextWith, scopeWith } from './support.js'

type Params = (string | number | null)[]
function fakeDb(answer: (sql: string, params: Params) => unknown[] | undefined): Database {
  return { query: async (sql: string, params: Params = []) => answer(sql, params) ?? [] } as unknown as Database
}

const tree = [
  { id: 'root', parent_id: null, type: 'collection', purpose: 'travels-root', display_order: 1, internal_name: 'root' },
  { id: 'trail-b', parent_id: 'root', type: 'exhibition trail', purpose: null, display_order: 2, internal_name: 'b' },
  { id: 'trail-a', parent_id: 'root', type: 'exhibition trail', purpose: null, display_order: 1, internal_name: 'a' },
  { id: 'itinerary', parent_id: 'trail-a', type: 'itinerary', purpose: null, display_order: 1, internal_name: 'i' },
  { id: 'location', parent_id: 'itinerary', type: 'location', purpose: null, display_order: 1, internal_name: 'l' },
]

describe('the Travels scope', () => {
  it('ships the whole tree, parents first, in display order', () => {
    expect(shippedTree('root', tree).map(c => c.id)).toEqual(['root', 'trail-a', 'trail-b', 'itinerary', 'location'])
  })

  it("takes the locations' members as its items and the trails' members as references", async () => {
    const asked: string[] = []
    const db = fakeDb((sql, params) => {
      asked.push(sql)
      if (sql.includes('FROM contexts')) return [{ id: 'travels-context' }]
      if (sql.includes('FROM collections')) return tree
      if (sql.includes('FROM collection_item') && params.includes('location')) return [{ id: 'monument', project_id: 'iam' }]
      if (sql.includes('FROM collection_item') && params.includes('trail-a')) {
        return [
          { collection_id: 'trail-a', item_id: 'isl-object' },
          { collection_id: 'trail-a', item_id: 'isl-monument' },
        ]
      }
      if (sql.includes('FROM collection_partner')) return [{ partner_id: 'museum' }]
      if (sql.includes('FROM projects')) return [{ context_id: 'iam-context' }]
      return undefined
    })
    const scope = await resolveScope(db)
    expect(scope).toMatchObject({
      rootId: 'root',
      collectionIds: ['root', 'trail-a', 'trail-b', 'itinerary', 'location'],
      trailIds: ['trail-a', 'trail-b'],
      itemIds: ['monument'],
      entryIds: ['isl-monument', 'isl-object'],
      projectIds: ['iam'],
      partnerIds: ['museum'],
      contextIds: ['travels-context', 'iam-context'],
    })
    expect(scope.entriesByTrail.get('trail-a')).toEqual(['isl-object', 'isl-monument'])
  })

  it('refuses a database with no Travels root', async () => {
    const db = fakeDb(sql => (sql.includes('FROM contexts') ? [{ id: 'travels-context' }] : []))
    await expect(resolveScope(db)).rejects.toThrow(/travels-root/)
  })
})

describe('the Travels exporters', () => {
  let outputDir: string
  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'travels-'))
  })
  afterEach(() => rmSync(outputDir, { recursive: true, force: true }))
  const read = (file: string) => JSON.parse(readFileSync(join(outputDir, file), 'utf-8'))

  it("gives a trail its entries, its starting point and its publication's page", async () => {
    const db = fakeDb((sql, params) => {
      if (sql.includes('FROM languages')) return [{ id: 'eng', backward_compatibility: 'en' }]
      if (sql.includes('FROM collections') && sql.includes('map_zoom')) {
        return ['root', 'trail-a'].map(id => ({
          id,
          type: id === 'root' ? 'collection' : 'exhibition trail',
          purpose: id === 'root' ? 'travels-root' : null,
          internal_name: id,
          backward_compatibility: `mwnf3_travels:${id}`,
          parent_id: id === 'root' ? null : 'root',
          display_order: null,
          country_id: null,
          latitude: null,
          longitude: null,
          map_zoom: null,
          extra: null,
        }))
      }
      if (sql.includes('FROM collection_item') && params.includes('isl-object')) {
        return [
          {
            collection_id: 'trail-a',
            item_id: 'isl-object',
            display_order: null,
            extra: { contextual_descriptions: { eng: 'Why it is on the trail' } },
          },
        ]
      }
      if (sql.includes('FROM collection_partner')) return [{ collection_id: 'trail-a', partner_id: 'museum', level: 'partner' }]
      if (sql.includes('FROM publication_collection')) return [{ collection_id: 'trail-a', publication_id: 'p1' }]
      if (sql.includes('FROM publications WHERE')) return [{ id: 'p1', backward_compatibility: 'mwnf3:bookbase:7' }]
      if (sql.includes('FROM publication_translations')) return [{ id: 'p1', language: 'en', title: 'Travel Book' }]
      return undefined
    })
    const scope = scopeWith({
      collectionIds: ['root', 'trail-a'],
      trailIds: ['trail-a'],
      entryIds: ['isl-object'],
    })
    await new CollectionExporter(contextWith(db, outputDir, scope)).export()
    const [root, trail] = read('collections.json')
    expect(root).not.toHaveProperty('entries')
    expect(trail).toMatchObject({
      id: 'trail-a',
      items: [],
      entries: [{ id: 'isl-object', display_order: null, contextual_descriptions: { en: 'Why it is on the trail' } }],
      partners: [{ id: 'museum', level: 'partner' }],
      publications: [
        {
          id: 'p1',
          titles: { en: 'Travel Book' },
          site: 'publications',
          path: '/publication/p1',
          url: 'https://example.test/publications/#/publication/p1',
        },
      ],
    })
  })

  it("lists a location's monuments by their legacy number, as legacy's itinerary gallery did", async () => {
    const asked: string[] = []
    const db = fakeDb(sql => {
      asked.push(sql)
      if (sql.includes('FROM languages')) return [{ id: 'eng', backward_compatibility: 'en' }]
      return undefined
    })
    const scope = scopeWith({ collectionIds: ['location'], itemIds: ['monument-b', 'monument-a'] })
    await new CollectionExporter(contextWith(db, outputDir, scope)).export()
    // tr_monuments ORDER BY number: the number ends the monument's legacy key.
    const members = asked.find(sql => sql.includes('JOIN items i ON i.id = ci.item_id')) ?? ''
    expect(members).toMatch(/ORDER BY ci\.collection_id, ci\.display_order IS NULL, ci\.display_order, i\.backward_compatibility, ci\.item_id/)
  })
  it("reads a monument's texts from its Travels row, whatever its project", async () => {
    const translation = (context_id: string, name: string) => ({
      item_id: 'monument',
      language_id: 'eng',
      context_id,
      name,
      alternate_name: null,
      description: null,
      type: null,
      holder: null,
      owner: null,
      initial_owner: null,
      dates: null,
      location: null,
      dimensions: null,
      place_of_production: null,
      method_for_datation: null,
      method_for_provenance: null,
      provenance: null,
      obtention: null,
      bibliography: null,
      extra: null,
      author_name: null,
      copy_editor_name: null,
      translator_name: null,
      translation_copy_editor_name: null,
    })
    const db = fakeDb(sql => {
      if (sql.includes('FROM languages')) return [{ id: 'eng', backward_compatibility: 'en' }]
      if (sql.includes('ORDER BY type, display_order, internal_name')) {
        return [{ id: 'monument', type: 'monument', internal_name: 'm', project_id: 'iam', latitude: null, longitude: null }]
      }
      if (sql.includes('FROM projects')) return [{ id: 'iam', context_id: 'a-iam-context' }]
      if (sql.includes('FROM item_translations it')) {
        return [translation('a-iam-context', 'Project row'), translation('travels-context', 'Travels row')]
      }
      return undefined
    })
    const scope = scopeWith({ itemIds: ['monument'], projectIds: ['iam'], contextIds: ['travels-context', 'a-iam-context'] })
    await new ItemExporter(contextWith(db, outputDir, scope)).export()
    expect(read('translations/items.en.json').monument).toEqual({ name: 'Travels row' })
    expect(read('items.json')[0]).not.toHaveProperty('filters')
  })

  it("names the site's address and its name in the manifest", async () => {
    const db = fakeDb((sql, params) => {
      if (sql.includes('FROM languages WHERE')) return [{ backward_compatibility: 'en' }]
      if (sql.includes('ct.context_id = ?')) return [{ language_id: 'eng', code: 'en', name: 'English' }]
      if (sql.includes('WHERE ct.collection_id = ?') && params[0] === 'root') return [{ language_id: 'en', title: 'Exhibition Trails' }]
      return undefined
    })
    await new ManifestExporter(contextWith(db, outputDir, scopeWith())).export()
    expect(read('manifest.json')).toMatchObject({
      kind: 'travels',
      site: {
        key: 'travels',
        languages: [{ code: 'en', label: 'English' }],
        names: { en: 'Exhibition Trails' },
        origin: 'https://example.test/travels',
      },
    })
  })
})

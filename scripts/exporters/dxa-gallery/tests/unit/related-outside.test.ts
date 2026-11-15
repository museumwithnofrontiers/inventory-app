import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ItemExporter } from '../../src/exporters/item-exporter.js'
import type { Database } from '../../src/core/database.js'
import type { ExportContext, Gallery } from '../../src/core/types.js'
import type { Logger } from '../../src/core/logger.js'

/**
 * Legacy's Related Objects (dxa-client DatabaseItem.vue) showed every related
 * object as a picture with its name and country, those outside the gallery
 * too. The package has no record of those, so their entry carries them.
 */
describe('ItemExporter — related objects outside the gallery', () => {
  let outputDir: string

  const gallery: Gallery = {
    id: 'gallery-uuid',
    backwardCompatibility: 'mwnf3_thematic_gallery:thg_gallery:1',
    slug: 'ceramics',
    host: 'https://ceramics.museumwnf.org',
    mwnf3ProjectId: 'DGA',
    projectId: 'dga-project-uuid',
    anchor: {},
    chrome: {},
  }

  const itemRow = (id: string) => ({
    id,
    type: 'object',
    internal_name: id,
    backward_compatibility: `mwnf3:objects:ISL:dz:Mus01:${id}`,
    parent_id: null,
    partner_id: null,
    country_id: 'dza',
    project_id: 'isl-project-uuid',
    owner_reference: null,
    mwnf_reference: null,
    start_date: null,
    end_date: null,
    display_order: null,
    latitude: null,
    longitude: null,
  })

  const link = (target: string) => ({
    source_id: 'item-a',
    target_id: target,
    target_type: 'object',
    target_backward_compatibility: `mwnf3:objects:ISL:dz:Mus01:${target}`,
    target_project_id: 'isl-project-uuid',
    language_id: null,
    justification: null,
  })

  const stubDb = (): Database =>
    ({
      query: async (sql: string) => {
        if (sql.includes('ORDER BY type, display_order, internal_name')) return [itemRow('item-a'), itemRow('item-b')]
        if (sql.includes('FROM item_item_links')) return [link('item-b'), link('item-out')]
        if (sql.includes('FROM languages')) {
          return [
            { id: 'eng', backward_compatibility: 'en' },
            { id: 'fra', backward_compatibility: 'fr' },
          ]
        }
        if (sql.includes('AS own')) {
          return [
            { item_id: 'item-out', language_id: 'eng', name: 'Bowl', own: 1 },
            { item_id: 'item-out', language_id: 'eng', name: 'Bowl (other context)', own: 0 },
            { item_id: 'item-out', language_id: 'fra', name: 'Coupe', own: 1 },
          ]
        }
        if (sql.includes('SELECT id, country_id FROM items')) return [{ id: 'item-out', country_id: 'mar' }]
        if (sql.includes('pic.parent_id AS item_id, ii.path')) {
          return [
            { item_id: 'item-out', path: 'images/first.jpg' },
            { item_id: 'item-out', path: 'images/second.jpg' },
          ]
        }
        return []
      },
    }) as unknown as Database

  const context = (db: Database): ExportContext => ({
    db,
    outputDir,
    siteKey: 'ceramics',
    gallery,
    memberItemIds: ['item-a', 'item-b'],
    itemOwnContextIds: new Map(),
    siteCollectionIds: new Set(),
    homeSites: { byProject: new Map(), bySiteCollection: new Map(), exhibitionSites: new Map() },
    baseUrl: 'https://example.test',
    logger: { info: () => {}, success: () => {}, warning: () => {}, error: () => {} } as unknown as Logger,
  })

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'ceramics-related-'))
  })

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true })
  })

  it('names, places and pictures a related object outside the gallery', async () => {
    await new ItemExporter(context(stubDb())).export()
    const items = JSON.parse(readFileSync(join(outputDir, 'items.json'), 'utf-8')) as Array<Record<string, unknown>>
    const related = items.find(item => item.id === 'item-a')?.related_items as Array<Record<string, unknown>>

    const outside = related.find(entry => entry.id === 'item-out')
    expect(outside?.in_package).toBe(false)
    expect(outside?.names).toEqual({ en: 'Bowl', fr: 'Coupe' })
    expect(outside?.country_id).toBe('mar')
    expect(String(outside?.image)).toContain('first')

    // A member is the package's own record: nothing is copied onto it.
    const member = related.find(entry => entry.id === 'item-b')
    expect(member?.in_package).toBe(true)
    expect(member).not.toHaveProperty('names')
    expect(member).not.toHaveProperty('image')
    expect(outside?.type).toBe('object')
  })

  it('orders related items by their legacy key, numbers as numbers, and types each', async () => {
    const target = (id: string, type: string, bc: string) => ({
      source_id: 'item-a', target_id: id, target_type: type, target_backward_compatibility: bc,
      target_project_id: 'isl-project-uuid', language_id: null, justification: null,
    })
    const db = {
      query: async (sql: string) => {
        if (sql.includes('ORDER BY type, display_order, internal_name')) return [itemRow('item-a')]
        // The query's own order is by target id, as an export of the database gives it.
        if (sql.includes('FROM item_item_links')) {
          return [
            target('a1', 'object', 'mwnf3:objects:ISL:jo:Mus01_H:34'),
            target('b2', 'monument', 'mwnf3:monuments:ISL:jo:Mon01:5'),
            target('c3', 'object', 'mwnf3:objects:ISL:jo:Mus01:9'),
            target('d4', 'object', 'mwnf3:objects:ISL:sy:Mus01:5'),
            target('e5', 'object', 'mwnf3:objects:ISL:jo:Mus01:10'),
          ]
        }
        return []
      },
    } as unknown as Database
    await new ItemExporter(context(db)).export()
    const items = JSON.parse(readFileSync(join(outputDir, 'items.json'), 'utf-8')) as Array<Record<string, unknown>>
    const related = items.find(item => item.id === 'item-a')?.related_items as Array<Record<string, unknown>>

    expect(related.map(entry => entry.id)).toEqual(['b2', 'c3', 'e5', 'a1', 'd4'])
    expect(related.map(entry => entry.type)).toEqual(['monument', 'object', 'object', 'object', 'object'])
  })
})

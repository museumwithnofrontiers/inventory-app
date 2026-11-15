import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ItemExporter } from '../../src/exporters/item-exporter.js'
import type { Database } from '../../src/core/database.js'
import type { ExportContext, Exhibition } from '../../src/core/types.js'
import type { Logger } from '../../src/core/logger.js'

/**
 * Legacy's Related Objects (the exhibitions client's DatabaseItem.vue) showed
 * every related object as a picture with its name and country, those outside
 * the exhibition too. The package has no record of those, so their entry
 * carries them, as a gallery's does.
 */
describe('ItemExporter — related items outside the exhibition', () => {
  let outputDir: string

  const exhibition: Exhibition = {
    id: 'exhibition-uuid',
    backwardCompatibility: 'mwnf3_thematic_gallery:thg_gallery:47',
    slug: 'water_in_islam',
    host: 'https://water-in-islam.museumwnf.org',
    mwnf3ProjectId: 'EXHWATER',
    projectId: 'exhwater-project-uuid',
    anchor: {},
    chrome: {},
    i18n: new Map(),
  }

  const itemRow = (id: string) => ({
    id,
    type: 'object',
    internal_name: id,
    backward_compatibility: `mwnf3:objects:ISL:jo:Mus01:${id}`,
    parent_id: null,
    partner_id: null,
    country_id: 'jor',
    project_id: 'isl-project-uuid',
    owner_reference: null,
    mwnf_reference: null,
    start_date: null,
    end_date: null,
    display_order: null,
    latitude: null,
    longitude: null,
  })

  const link = (target: string, type: string, bc: string) => ({
    source_id: 'item-a',
    target_id: target,
    target_type: type,
    target_backward_compatibility: bc,
    target_project_id: 'isl-project-uuid',
    language_id: null,
    justification: null,
  })

  const stubDb = (): Database =>
    ({
      query: async (sql: string) => {
        if (sql.includes('ORDER BY type, display_order, internal_name')) return [itemRow('item-a'), itemRow('item-b')]
        if (sql.includes('FROM item_item_links')) {
          return [
            link('item-b', 'monument', 'mwnf3:monuments:ISL:pa:Mon01:22'),
            link('item-out', 'object', 'mwnf3:objects:ISL:uk:Mus01:10'),
            link('item-out2', 'object', 'mwnf3:objects:ISL:de:Mus01:15'),
          ]
        }
        if (sql.includes('FROM languages')) {
          return [
            { id: 'eng', backward_compatibility: 'en' },
            { id: 'fra', backward_compatibility: 'fr' },
          ]
        }
        if (sql.includes('AS own')) {
          return [
            { item_id: 'item-out', language_id: 'eng', name: 'Column capital', own: 1 },
            { item_id: 'item-out', language_id: 'eng', name: 'Capital (other context)', own: 0 },
            { item_id: 'item-out', language_id: 'fra', name: 'Chapiteau', own: 1 },
          ]
        }
        if (sql.includes('SELECT id, country_id FROM items')) return [{ id: 'item-out', country_id: 'gbr' }]
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
    exhibition,
    themes: [],
    memberItemIds: ['item-a', 'item-b'],
    itemOwnContextIds: new Map(),
    siteCollectionIds: new Set(),
    exhibitionSites: new Map(),
    homeSites: { byProject: new Map(), bySiteCollection: new Map() },
    baseUrl: 'https://example.test',
    logger: { info: () => {}, success: () => {}, warning: () => {}, error: () => {} } as unknown as Logger,
    siteKey: 'water-in-islam',
  })

  const related = (): Array<Record<string, unknown>> => {
    const items = JSON.parse(readFileSync(join(outputDir, 'items.json'), 'utf-8')) as Array<Record<string, unknown>>
    return items.find(item => item.id === 'item-a')?.related_items as Array<Record<string, unknown>>
  }

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'water-related-'))
  })

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true })
  })

  it('names, places and pictures a related item outside the exhibition', async () => {
    await new ItemExporter(context(stubDb())).export()

    const outside = related().find(entry => entry.id === 'item-out')
    expect(outside?.in_package).toBe(false)
    expect(outside?.names).toEqual({ en: 'Column capital', fr: 'Chapiteau' })
    expect(outside?.country_id).toBe('gbr')
    expect(String(outside?.image)).toContain('first')

    // One with no translation, country or picture still says so.
    const bare = related().find(entry => entry.id === 'item-out2')
    expect(bare?.names).toEqual({})
    expect(bare?.country_id).toBeNull()
    expect(bare?.image).toBeNull()

    // A member is the package's own record: nothing is copied onto it.
    const member = related().find(entry => entry.id === 'item-b')
    expect(member?.in_package).toBe(true)
    expect(member).not.toHaveProperty('names')
    expect(member).not.toHaveProperty('image')
  })

  it('types each related item and orders them by their legacy key', async () => {
    await new ItemExporter(context(stubDb())).export()

    expect(related().map(entry => [entry.id, entry.type])).toEqual([
      ['item-b', 'monument'],
      ['item-out2', 'object'],
      ['item-out', 'object'],
    ])
  })
})

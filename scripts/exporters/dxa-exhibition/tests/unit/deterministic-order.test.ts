import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ItemExporter } from '../../src/exporters/item-exporter.js'
import { ExhibitionExporter } from '../../src/exporters/exhibition-exporter.js'
import { ThemeExporter } from '../../src/exporters/theme-exporter.js'
import type { Database } from '../../src/core/database.js'
import type { ExportContext, Exhibition, Theme } from '../../src/core/types.js'
import type { Logger } from '../../src/core/logger.js'

/**
 * #1916 — a per-item list assembled from a query with no ORDER BY comes out
 * in MySQL's row order, which is an implementation detail that can change
 * between two exports of the same, unchanged database. Every query
 * ItemExporter uses to build a per-item list or a translation-file key now
 * carries an explicit ORDER BY; this pins that each one does, so a
 * regression (someone drops the clause) fails a test rather than surfacing
 * only as unexplained package-diff noise months later.
 */
describe('ItemExporter — deterministic list order (#1916)', () => {
  let outputDir: string
  let queries: string[]

  const exhibition: Exhibition = {
    id: 'exhibition-uuid',
    backwardCompatibility: 'mwnf3_thematic_gallery:thg_gallery:47',
    slug: 'the_use_of_colours_in_art',
    host: 'https://the-use-of-colours-in-art.museumwnf.org',
    mwnf3ProjectId: 'EXHCOLOUR',
    projectId: 'exhcolour-project-uuid',
    anchor: {},
    chrome: {},
    i18n: new Map(),
  }

  const itemRow = {
    id: 'item-a',
    type: 'object',
    internal_name: 'Colour item A',
    backward_compatibility: 'mwnf3:objects:EXHCOLOUR:en:Mus01:1',
    parent_id: null,
    partner_id: null,
    country_id: null,
    project_id: 'exhcolour-project-uuid',
    owner_reference: null,
    mwnf_reference: null,
    start_date: null,
    end_date: null,
    display_order: null,
    latitude: null,
    longitude: null,
  }

  const stubDb = (): Database =>
    ({
      query: async (sql: string) => {
        queries.push(sql)
        if (sql.includes('ORDER BY type, display_order, internal_name')) return [itemRow]
        return []
      },
    }) as unknown as Database

  const context = (db: Database): ExportContext => ({
    db,
    outputDir,
    exhibition,
    themes: [],
    memberItemIds: ['item-a'],
    itemOwnContextIds: new Map(),
    baseUrl: 'https://example.test',
    logger: {
      info: () => {},
      success: () => {},
      warning: () => {},
      error: () => {},
    } as unknown as Logger,
    siteKey: 'the-use-of-colours-in-art',
  })

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'colours-deterministic-order-'))
    queries = []
  })

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true })
  })

  it('orders item_translations by item_id, context_id', async () => {
    const db = stubDb()
    await new ItemExporter(context(db)).export()
    expect(queries.some(sql => sql.includes('ORDER BY it.item_id, it.context_id'))).toBe(true)
  })

  it('orders the picture-caption query by picture_id, language_id', async () => {
    const db: Database = {
      query: async (sql: string) => {
        queries.push(sql)
        if (sql.includes('ORDER BY type, display_order, internal_name')) return [itemRow]
        if (sql.includes("pic.type = 'picture'")) {
          return [{ picture_id: 'pic-1', item_id: 'item-a', display_order: 1, path: 'x.jpg', alt_text: null }]
        }
        return []
      },
    } as unknown as Database
    await new ItemExporter(context(db)).export()
    expect(queries.some(sql => sql.includes('ORDER BY picture_id, language_id'))).toBe(true)
  })

  it('orders item_tag by item_id, category, description, id', async () => {
    const db = stubDb()
    await new ItemExporter(context(db)).export()
    expect(
      queries.some(sql => sql.includes('ORDER BY it.item_id, t.category, t.description, t.id'))
    ).toBe(true)
  })

  it('orders item_dynasty by item_id, dynasty_id', async () => {
    const db = stubDb()
    await new ItemExporter(context(db)).export()
    expect(queries.some(sql => sql.includes('ORDER BY item_id, dynasty_id'))).toBe(true)
  })

  it('orders the glossary-link query by item_id, glossary_id', async () => {
    const db = stubDb()
    await new ItemExporter(context(db)).export()
    expect(queries.some(sql => sql.includes('ORDER BY it.item_id, gs.glossary_id'))).toBe(true)
  })

  it('orders artist_item by item_id, name', async () => {
    const db = stubDb()
    await new ItemExporter(context(db)).export()
    expect(queries.some(sql => sql.includes('ORDER BY ai.item_id, a.name'))).toBe(true)
  })

  it('orders item_item_links by source_id, target_id, language_id', async () => {
    const db = stubDb()
    await new ItemExporter(context(db)).export()
    expect(
      queries.some(sql => sql.includes('ORDER BY iil.source_id, iil.target_id, iilt.language_id'))
    ).toBe(true)
  })

  it('orders the "also on display in" gallery-reference query by item_id, collection id', async () => {
    const db = stubDb()
    await new ItemExporter(context(db)).export()
    expect(queries.some(sql => sql.includes('ORDER BY ci.item_id, c.id'))).toBe(true)
  })
})

describe('ExhibitionExporter — deterministic list order (#1916)', () => {
  let outputDir: string
  let queries: string[]

  const exhibition: Exhibition = {
    id: 'exhibition-uuid',
    backwardCompatibility: 'mwnf3_thematic_gallery:thg_gallery:47',
    slug: 'the_use_of_colours_in_art',
    host: 'https://the-use-of-colours-in-art.museumwnf.org',
    mwnf3ProjectId: 'EXHCOLOUR',
    projectId: 'exhcolour-project-uuid',
    anchor: { hidden_partners: ['mwnf3:museums:B:x', 'mwnf3:museums:A:x'] } as Exhibition['anchor'],
    chrome: {},
    i18n: new Map(),
  }

  const context = (db: Database): ExportContext => ({
    db,
    outputDir,
    exhibition,
    themes: [],
    memberItemIds: [],
    itemOwnContextIds: new Map(),
    baseUrl: 'https://example.test',
    logger: {
      info: () => {},
      success: () => {},
      warning: () => {},
      error: () => {},
    } as unknown as Logger,
    siteKey: 'the-use-of-colours-in-art',
  })

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'colours-exhibition-order-'))
    queries = []
  })

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true })
  })

  it('orders the sibling-site title/chrome queries by collection_id, language_id', async () => {
    const db: Database = {
      query: async (sql: string) => {
        queries.push(sql)
        if (sql.includes("type IN ('gallery', 'exhibition')")) {
          return [{ id: 'sibling-1', backward_compatibility: 'mwnf3_thematic_gallery:thg_gallery:48', type: 'gallery', extra: null }]
        }
        return []
      },
    } as unknown as Database
    await new ExhibitionExporter(context(db)).export()
    const siblingQueries = queries.filter(sql => sql.includes('FROM collection_translations'))
    expect(siblingQueries.filter(sql => sql.includes('ORDER BY collection_id, language_id')).length).toBe(2)
  })

  /**
   * `hidden_partner_ids` resolves the curated `extra.thg_gallery.hidden_partners`
   * keys (an author-ordered list) to partner UUIDs via an `IN (...)` query,
   * whose row order MySQL does not promise matches the IN-list order. The fix
   * re-maps results back into the curated `keys` order instead of trusting the
   * query's row order — this feeds the two rows back in the OPPOSITE of that
   * order and asserts the output still follows the curated key order.
   */
  it('resolves hidden_partner_ids in the curated key order, not the query row order', async () => {
    const db: Database = {
      query: async (sql: string) => {
        queries.push(sql)
        if (sql.includes('FROM partners') && sql.includes('backward_compatibility IN')) {
          // Rows come back in the OPPOSITE of the curated `keys` order.
          return [
            { id: 'partner-a-uuid', backward_compatibility: 'mwnf3:museums:A:x' },
            { id: 'partner-b-uuid', backward_compatibility: 'mwnf3:museums:B:x' },
          ]
        }
        return []
      },
    } as unknown as Database
    await new ExhibitionExporter(context(db)).export()
    const output = JSON.parse(
      readFileSync(join(outputDir, 'exhibition.json'), 'utf-8')
    ) as { hidden_partner_ids: string[] }
    expect(output.hidden_partner_ids).toEqual(['partner-b-uuid', 'partner-a-uuid'])
  })
})

describe('ThemeExporter — deterministic list order (#1916)', () => {
  let outputDir: string
  let queries: string[]

  const exhibition: Exhibition = {
    id: 'exhibition-uuid',
    backwardCompatibility: 'mwnf3_thematic_gallery:thg_gallery:47',
    slug: 'the_use_of_colours_in_art',
    host: null,
    mwnf3ProjectId: null,
    projectId: null,
    anchor: {},
    chrome: {},
    i18n: new Map(),
  }

  const theme: Theme = {
    id: 'theme-1',
    backwardCompatibility: 'mwnf3_thematic_gallery:theme:47:1',
    internalName: 'Theme One',
    displayOrder: 1,
    parentId: 'exhibition-uuid',
    coverPictureItemId: null,
  }

  const context = (db: Database): ExportContext => ({
    db,
    outputDir,
    exhibition,
    themes: [theme],
    memberItemIds: [],
    itemOwnContextIds: new Map(),
    baseUrl: 'https://example.test',
    logger: {
      info: () => {},
      success: () => {},
      warning: () => {},
      error: () => {},
    } as unknown as Logger,
    siteKey: 'the-use-of-colours-in-art',
  })

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'colours-theme-order-'))
    queries = []
  })

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true })
  })

  it('orders the theme-translation query by collection_id, language_id', async () => {
    const db: Database = {
      query: async (sql: string) => {
        queries.push(sql)
        return []
      },
    } as unknown as Database
    await new ThemeExporter(context(db)).export()
    expect(
      queries.some(
        sql => sql.includes('FROM collection_translations') && sql.includes('ORDER BY collection_id, language_id')
      )
    ).toBe(true)
  })

  it('orders the related-picture-link translation query by item_item_link_id, language_id', async () => {
    const db: Database = {
      query: async (sql: string) => {
        queries.push(sql)
        if (sql.includes('FROM collection_item')) {
          return [{ collection_id: 'theme-1', item_id: 'pic-1', display_order: 1, extra: null }]
        }
        if (sql.includes('FROM item_item_links')) {
          return [{ id: 'link-1', source_id: 'pic-1', target_id: 'pic-2', backward_compatibility: null }]
        }
        return []
      },
    } as unknown as Database
    await new ThemeExporter(context(db)).export()
    expect(
      queries.some(sql => sql.includes('ORDER BY item_item_link_id, language_id'))
    ).toBe(true)
  })
})

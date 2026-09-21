import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ItemExporter } from '../../src/exporters/item-exporter.js'
import type { Database } from '../../src/core/database.js'
import type { ExportContext } from '../../src/core/types.js'
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

  const itemRow = {
    id: 'item-a',
    type: 'object',
    internal_name: 'Item A',
    backward_compatibility: 'mwnf3:objects:ISL:en:Mus01:1',
    parent_id: null,
    partner_id: null,
    country_id: null,
    collection_id: null,
    project_id: 'isl-project-uuid',
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
    projectIds: ['isl-project-uuid'],
    contextIds: ['isl-context-uuid'],
    projectKeys: ['ISL'],
    baseUrl: 'https://example.test',
    logger: {
      info: () => {},
      success: () => {},
      warning: () => {},
      error: () => {},
    } as unknown as Logger,
  })

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'islamicart-deterministic-order-'))
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

  it('orders item_dynasty by item_id, dynasty_id', async () => {
    const db = stubDb()
    await new ItemExporter(context(db)).export()
    expect(queries.some(sql => sql.includes('ORDER BY item_id, dynasty_id'))).toBe(true)
  })

  it('orders item_tag by item_id, description', async () => {
    const db = stubDb()
    await new ItemExporter(context(db)).export()
    expect(queries.some(sql => sql.includes('ORDER BY it2.item_id, t.description'))).toBe(true)
  })

  it('orders the glossary-link query by item_id, glossary_id', async () => {
    const db = stubDb()
    await new ItemExporter(context(db)).export()
    expect(queries.some(sql => sql.includes('ORDER BY it3.item_id, gs.glossary_id'))).toBe(true)
  })

  it('orders artist_item by item_id, name', async () => {
    const db = stubDb()
    await new ItemExporter(context(db)).export()
    expect(queries.some(sql => sql.includes('ORDER BY ai.item_id, a.name'))).toBe(true)
  })

  it('orders the THG-gallery cross-reference query by item_id, internal_name, id', async () => {
    const db = stubDb()
    await new ItemExporter(context(db)).export()
    expect(
      queries.some(sql => sql.includes('ORDER BY ci.item_id, c.internal_name, c.id'))
    ).toBe(true)
  })

  it('orders item_item_links by source_id, target_id, language_id', async () => {
    const db = stubDb()
    await new ItemExporter(context(db)).export()
    expect(
      queries.some(sql => sql.includes('ORDER BY iil.source_id, iil.target_id, iilt.language_id'))
    ).toBe(true)
  })
})

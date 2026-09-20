import { mkdtempSync, rmSync } from 'fs'
import { readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ItemExporter } from '../../src/exporters/item-exporter.js'
import type { Database } from '../../src/core/database.js'
import type { ExportContext, Gallery } from '../../src/core/types.js'
import type { Logger } from '../../src/core/logger.js'

/**
 * Every entry in `items.json` carries the item's own `project_id` (UUID),
 * and so does every `related_items` stub (a link to an item outside the
 * gallery, which can only be shipped as a reference — decision Q3). The
 * legacy `project_key` twin both originally shipped alongside (epic #1727
 * phase 2) is gone as of the cleanup wave; these cases pin its absence.
 */
describe('ItemExporter — project_id', () => {
  let outputDir: string
  let queries: { sql: string }[]

  const gallery: Gallery = {
    id: 'gallery-uuid',
    backwardCompatibility: 'mwnf3_thematic_gallery:thg_gallery:4',
    slug: 'amulets',
    host: 'https://amulets.museumwnf.org',
    mwnf3ProjectId: null,
    projectId: null,
    anchor: {},
    chrome: {},
  }

  const itemRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'item-a',
    type: 'object',
    internal_name: 'Amulet A',
    backward_compatibility: 'mwnf3:objects:EPM:en:Mus01:1',
    parent_id: null,
    partner_id: null,
    country_id: null,
    project_id: 'epm-project-uuid',
    owner_reference: null,
    mwnf_reference: null,
    start_date: null,
    end_date: null,
    display_order: null,
    latitude: null,
    longitude: null,
    ...overrides,
  })

  const stubDb = (rows: { items?: unknown[]; itemItemLinks?: unknown[] }): Database =>
    ({
      query: async (sql: string) => {
        queries.push({ sql })
        if (sql.includes('ORDER BY type, display_order, internal_name')) return rows.items ?? []
        if (sql.includes('FROM item_item_links')) return rows.itemItemLinks ?? []
        return []
      },
    }) as unknown as Database

  const context = (db: Database): ExportContext => ({
    db,
    outputDir,
    gallery,
    memberItemIds: ['item-a'],
    itemOwnContextIds: new Map(),
    baseUrl: 'https://example.test',
    logger: {
      info: () => {},
      success: () => {},
      warning: () => {},
      error: () => {},
    } as unknown as Logger,
  })

  const readOutput = (): Array<Record<string, unknown>> =>
    JSON.parse(readFileSync(join(outputDir, 'items.json'), 'utf-8')) as Array<Record<string, unknown>>

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'amulets-item-exporter-'))
    queries = []
  })

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true })
  })

  it('carries the item own project_id (UUID), with no legacy project_key', async () => {
    const db = stubDb({ items: [itemRow()] })
    await new ItemExporter(context(db)).export()

    const item = readOutput()[0]
    expect(item?.project_id).toBe('epm-project-uuid')
    expect(item).not.toHaveProperty('project_key')
  })

  it('reports null project_id when the item has no project (item.project_id column is null)', async () => {
    const db = stubDb({ items: [itemRow({ project_id: null })] })
    await new ItemExporter(context(db)).export()

    expect(readOutput()[0]?.project_id).toBeNull()
  })

  it('carries the related-item stub own project_id (UUID), with no legacy project_key', async () => {
    const db = stubDb({
      items: [itemRow()],
      itemItemLinks: [
        {
          source_id: 'item-a',
          target_id: 'item-outside',
          target_backward_compatibility: 'mwnf3:objects:ISL:en:Mus02:9',
          target_project_id: 'isl-project-uuid',
          language_id: null,
          justification: null,
        },
      ],
    })
    await new ItemExporter(context(db)).export()

    const related = (readOutput()[0]?.related_items as Array<Record<string, unknown>>)[0]
    expect(related?.id).toBe('item-outside')
    expect(related?.project_id).toBe('isl-project-uuid')
    expect(related).not.toHaveProperty('project_key')
  })

  it('reports null related-item project_id when the target has no project', async () => {
    const db = stubDb({
      items: [itemRow()],
      itemItemLinks: [
        {
          source_id: 'item-a',
          target_id: 'item-outside',
          target_backward_compatibility: 'mwnf3:objects:XXX:en:Mus02:9',
          target_project_id: null,
          language_id: null,
          justification: null,
        },
      ],
    })
    await new ItemExporter(context(db)).export()

    const related = (readOutput()[0]?.related_items as Array<Record<string, unknown>>)[0]
    expect(related?.project_id).toBeNull()
  })
})

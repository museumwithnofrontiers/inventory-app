import { mkdtempSync, rmSync } from 'fs'
import { readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ItemExporter } from '../../src/exporters/item-exporter.js'
import type { Database } from '../../src/core/database.js'
import type { ExportContext, Exhibition } from '../../src/core/types.js'
import type { Logger } from '../../src/core/logger.js'

/**
 * Epic #1727 phase 2 follow-up: every `related_items` stub — a link to an
 * item outside the exhibition, which can only be shipped as a reference
 * (decision Q3) — must carry the target's own `project_id` (UUID) next to
 * `target_project_bc`/`project_key`. Member items already carried
 * `project_id`; this pins that it keeps working.
 */
describe('ItemExporter — project_id', () => {
  let outputDir: string
  let queries: { sql: string }[]

  const exhibition: Exhibition = {
    id: 'exhibition-uuid',
    backwardCompatibility: 'mwnf3_thematic_gallery:thg_gallery:56',
    slug: 'water_in_islam',
    host: 'https://water-in-islam.museumwnf.org',
    mwnf3ProjectId: 'GalEx6',
    projectId: 'galex6-project-uuid',
    anchor: {},
    chrome: {},
    i18n: new Map(),
  }

  const itemRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'item-a',
    type: 'object',
    internal_name: 'Water item A',
    backward_compatibility: 'mwnf3:objects:GalEx6:en:Mus01:1',
    parent_id: null,
    partner_id: null,
    country_id: null,
    project_id: 'galex6-project-uuid',
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
    exhibition,
    themes: [],
    memberItemIds: ['item-a'],
    itemProjectKeys: new Map([['item-a', 'GalEx6']]),
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
    outputDir = mkdtempSync(join(tmpdir(), 'water-item-exporter-'))
    queries = []
  })

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true })
  })

  it('carries the item own project_id (UUID) alongside the legacy project_key', async () => {
    const db = stubDb({ items: [itemRow()] })
    await new ItemExporter(context(db)).export()

    const item = readOutput()[0]
    expect(item?.project_id).toBe('galex6-project-uuid')
    expect(item?.project_key).toBe('GalEx6')
  })

  it('carries the related-item stub own project_id (UUID) alongside its legacy project_key', async () => {
    const db = stubDb({
      items: [itemRow()],
      itemItemLinks: [
        {
          source_id: 'item-a',
          target_id: 'item-outside',
          target_backward_compatibility: 'mwnf3:objects:ISL:en:Mus02:9',
          target_project_id: 'isl-project-uuid',
          target_project_bc: 'mwnf3:projects:ISL',
          language_id: null,
          justification: null,
        },
      ],
    })
    await new ItemExporter(context(db)).export()

    const related = (readOutput()[0]?.related_items as Array<Record<string, unknown>>)[0]
    expect(related?.id).toBe('item-outside')
    expect(related?.project_id).toBe('isl-project-uuid')
    expect(related?.project_key).toBe('ISL')
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
          target_project_bc: null,
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

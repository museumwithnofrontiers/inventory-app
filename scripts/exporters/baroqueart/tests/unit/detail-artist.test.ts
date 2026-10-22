import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ItemExporter } from '../../src/exporters/item-exporter.js'
import type { Database } from '../../src/core/database.js'
import type { ExportContext } from '../../src/core/types.js'
import type { Logger } from '../../src/core/logger.js'

/**
 * A monument detail's artist line differs per language ("Hubert Gerhard (um 1545-1623)" in
 * German, "(c. 1545–1623)" in English), and legacy prints the page language's line. The
 * detail's `artist_names` merge every language's names, so each detail translation ships
 * its own line as `artist`.
 */
describe('ItemExporter — monument detail artist line', () => {
  let outputDir: string

  const itemRow = {
    id: 'item-a',
    type: 'monument',
    internal_name: 'Monument A',
    backward_compatibility: 'mwnf3:monuments:BAR:at:Mon11:2',
    parent_id: null,
    partner_id: null,
    country_id: null,
    collection_id: null,
    project_id: 'bar-project-uuid',
    owner_reference: null,
    mwnf_reference: null,
    start_date: null,
    end_date: null,
    display_order: null,
    latitude: null,
    longitude: null,
  }

  const db = {
    query: async (sql: string) => {
      if (sql.includes('FROM languages')) return [{ id: 'deu', backward_compatibility: 'de' }]
      if (sql.includes('ORDER BY type, display_order, internal_name')) return [itemRow]
      if (sql.includes("type = 'detail'")) {
        return [
          {
            id: 'detail-1',
            internal_name: 'Grabmal',
            backward_compatibility: null,
            parent_id: 'item-a',
            display_order: 1,
          },
        ]
      }
      if (sql.includes('FROM item_translations') && sql.includes('dates, location, extra')) {
        return [
          {
            item_id: 'detail-1',
            language_id: 'deu',
            context_id: 'bar-context-uuid',
            name: 'Grabmal',
            description: null,
            dates: '1629 aufgestellt',
            location: null,
            extra: { artist: 'Hubert Gerhard (um 1545-1623); Caspar Gras (1585-1674)' },
          },
        ]
      }
      return []
    },
  } as unknown as Database

  const context = (): ExportContext => ({
    db,
    outputDir,
    projectIds: ['bar-project-uuid'],
    contextIds: ['bar-context-uuid'],
    projectKeys: ['BAR'],
    baseUrl: 'https://example.test',
    logger: {
      info: () => {},
      success: () => {},
      warning: () => {},
      error: () => {},
    } as unknown as Logger,
  })

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'baroqueart-detail-artist-'))
  })

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true })
  })

  it("ships each detail translation's own artist line", async () => {
    await new ItemExporter(context()).export()
    const de = JSON.parse(readFileSync(join(outputDir, 'translations/items.de.json'), 'utf-8'))

    expect(de['detail-1']).toEqual({
      name: 'Grabmal',
      dates: '1629 aufgestellt',
      artist: 'Hubert Gerhard (um 1545-1623); Caspar Gras (1585-1674)',
    })
  })
})

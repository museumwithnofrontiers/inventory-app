import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Database } from '../../src/core/database.js'
import { GalleryExporter } from '../../src/exporters/gallery-exporter.js'
import type { ExportContext, Gallery } from '../../src/core/types.js'
import type { Logger } from '../../src/core/logger.js'
import { itemShipped } from '../../../shared/drafts.mjs'

const quiet = { info: () => {}, success: () => {}, warning: () => {}, error: () => {} } as unknown as Logger

describe('drafts in the gallery scope (M17 B3)', () => {
  it('asks only for shipped members', async () => {
    const db = new Database()
    const query = vi.spyOn(db, 'query').mockResolvedValue([])
    await db.resolveMembers('gallery-uuid')
    expect(query.mock.calls[0]?.[0]).toContain(itemShipped('i'))
  })

  it('refuses a draft gallery: it ships nowhere', async () => {
    const db = new Database()
    vi.spyOn(db, 'query').mockResolvedValueOnce([
      { id: 'gallery-uuid', backward_compatibility: 'mwnf3_thematic_gallery:thg_gallery:9', type: 'gallery', draft: 1, extra: null },
    ])
    await expect(db.resolveGallery('gallery-uuid')).rejects.toThrow(/draft/)
  })
})

describe('drafts in gallery.json (M17 B3)', () => {
  let outputDir: string
  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'gallery-drafts-'))
  })
  afterEach(() => rmSync(outputDir, { recursive: true, force: true }))

  const gallery: Gallery = {
    id: 'gallery-uuid',
    backwardCompatibility: 'mwnf3_thematic_gallery:thg_gallery:9',
    slug: 'carpets',
    host: null,
    mwnf3ProjectId: null,
    projectId: null,
    anchor: {},
    chrome: { banner_item: 'mwnf#obj#DCA;sw;Mus01;42', homepage_item: 'mwnf#obj#DCA;sw;Mus01;43' },
  }
  const context = (db: Database): ExportContext => ({
    db,
    outputDir,
    siteKey: 'carpets',
    gallery,
    memberItemIds: [],
    itemOwnContextIds: new Map(),
    siteCollectionIds: new Set(['gallery-uuid', 'glass-uuid', 'draft-uuid']),
    homeSites: { byProject: new Map(), bySiteCollection: new Map(), exhibitionSites: new Map() },
    baseUrl: 'https://example.test',
    logger: quiet,
  })

  it('names no draft banner item and lists no draft sibling', async () => {
    const sibling = (id: string, legacyId: number) => ({
      id,
      backward_compatibility: `mwnf3_thematic_gallery:thg_gallery:${legacyId}`,
      extra: { thg_gallery: { slug: id } },
    })
    const asked: string[] = []
    const db = {
      query: async (sql: string, params: unknown[] = []) => {
        asked.push(sql)
        if (sql.includes('SELECT id, parent_id, draft FROM collections')) {
          return [
            { id: 'glass-uuid', parent_id: null, draft: 0 },
            { id: 'draft-uuid', parent_id: null, draft: 1 },
          ]
        }
        if (sql.includes('FROM collections')) return [sibling('glass-uuid', 18), sibling('draft-uuid', 50)]
        if (sql.includes('FROM items WHERE backward_compatibility')) {
          // The banner item is a draft, the homepage item ships.
          return String(params[0]).endsWith(':42') ? [{ id: 'banner', shipped: 0 }] : [{ id: 'homepage', shipped: 1 }]
        }
        return []
      },
    } as unknown as Database
    await new GalleryExporter(context(db)).export()

    const output = JSON.parse(readFileSync(join(outputDir, 'gallery.json'), 'utf-8')) as Record<string, unknown>
    expect(output['banner_item_id']).toBeNull()
    expect(output['homepage_item_id']).toBe('homepage')
    expect((output['sibling_galleries'] as { id: string }[]).map(s => s.id)).toEqual(['glass-uuid'])
    expect(asked.find(sql => sql.includes('FROM items WHERE backward_compatibility'))).toContain(itemShipped('items'))
  })
})

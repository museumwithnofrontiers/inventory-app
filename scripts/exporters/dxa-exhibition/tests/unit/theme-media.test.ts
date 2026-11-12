import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ThemeExporter } from '../../src/exporters/theme-exporter.js'
import type { Database } from '../../src/core/database.js'
import type { ExportContext, Exhibition, Theme } from '../../src/core/types.js'
import type { Logger } from '../../src/core/logger.js'

/**
 * inventory-app#2491 — legacy listed a theme's audio and video under "Related
 * Audio/Videos" on its page (exhibitions-client ThemeComponent, dxa-api
 * THG/Video ordered by the media's id). The importer files them in
 * `collection_media`; the theme exporter now ships them on each theme and
 * sub-theme, in item media's shape, in legacy's order, and nothing else of
 * `collection_media` (the related content rides elsewhere).
 */
describe('ThemeExporter — a theme\'s audio and video', () => {
  let outputDir: string

  const exhibition: Exhibition = {
    id: 'exhibition-uuid',
    backwardCompatibility: 'mwnf3_thematic_gallery:thg_gallery:52',
    slug: 'the_table_is_set',
    host: 'https://exhibitions.museumwnf.org/the_table_is_set',
    mwnf3ProjectId: 'EXH',
    projectId: 'exh-project-uuid',
    anchor: {},
    chrome: {},
    i18n: new Map(),
  }

  const themes: Theme[] = [
    { id: 'theme-5', backwardCompatibility: 'mwnf3_thematic_gallery:theme:52:5', internalName: 'theme_52_5', displayOrder: 2, parentId: 'exhibition-uuid', coverPictureItemId: null },
    { id: 'theme-6', backwardCompatibility: 'mwnf3_thematic_gallery:theme:52:6', internalName: 'theme_52_6', displayOrder: 3, parentId: 'exhibition-uuid', coverPictureItemId: null },
  ]

  const media = [
    // Stored out of legacy's order: ids 9, 3, 4 on theme 5 (string order would put 9 last only by luck).
    { collection_id: 'theme-5', language_id: 'eng', type: 'video', title: 'Dine Like a Sultan', description: 'By LACMA', url: 'https://youtu.be/9', backward_compatibility: 'mwnf3_thematic_gallery:theme_video:9:52:5' },
    { collection_id: 'theme-5', language_id: 'eng', type: 'video', title: 'Nael Chami (English)', description: null, url: 'https://youtu.be/3', backward_compatibility: 'mwnf3_thematic_gallery:theme_video:3:52:5' },
    { collection_id: 'theme-5', language_id: 'eng', type: 'video', title: 'Nael Chami (Arabic)', description: null, url: 'https://youtu.be/4', backward_compatibility: 'mwnf3_thematic_gallery:theme_video:4:52:5' },
    { collection_id: 'theme-5', language_id: 'eng', type: 'audio', title: 'A recording', description: null, url: 'https://example.test/a.mp3', backward_compatibility: 'mwnf3_thematic_gallery:theme_audio:1:52:5' },
  ]

  const context = (db: Database): ExportContext => ({
    db,
    outputDir,
    exhibition,
    themes,
    memberItemIds: [],
    itemOwnContextIds: new Map(),
    siteCollectionIds: new Set(),
    exhibitionSites: new Map(),
    homeSites: { byProject: new Map(), bySiteCollection: new Map() },
    baseUrl: 'https://example.test',
    logger: { info: () => {}, success: () => {}, warning: () => {}, error: () => {} } as unknown as Logger,
    siteKey: 'the-table-is-set',
  }) as unknown as ExportContext

  let mediaSql = ''
  const stubDb = (): Database =>
    ({
      query: async (sql: string) => {
        if (sql.includes('FROM languages')) return [{ id: 'eng', backward_compatibility: 'en' }]
        if (sql.includes('FROM collection_media')) {
          mediaSql = sql
          return media
        }
        return []
      },
    }) as unknown as Database

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'theme-media-'))
    mediaSql = ''
  })

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true })
  })

  it("ships each theme's audio and video in legacy's order, item media's shape", async () => {
    await new ThemeExporter(context(stubDb())).export()
    const output = JSON.parse(readFileSync(join(outputDir, 'themes.json'), 'utf8'))
    const [five, six] = output
    expect(five.media).toEqual([
      { type: 'audio', title: 'A recording', description: null, url: 'https://example.test/a.mp3', language: 'en' },
      { type: 'video', title: 'Nael Chami (English)', description: null, url: 'https://youtu.be/3', language: 'en' },
      { type: 'video', title: 'Nael Chami (Arabic)', description: null, url: 'https://youtu.be/4', language: 'en' },
      { type: 'video', title: 'Dine Like a Sultan', description: 'By LACMA', url: 'https://youtu.be/9', language: 'en' },
    ])
    expect(six.media).toEqual([])
  })

  it("reads only the theme media of collection_media, not the related content", async () => {
    await new ThemeExporter(context(stubDb())).export()
    expect(mediaSql).toContain("mwnf3\\_thematic\\_gallery:theme\\_%")
  })
})

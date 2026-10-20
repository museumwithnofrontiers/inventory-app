import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ItemExporter, sharingHistoryArtistNames } from '../../src/exporters/item-exporter.js'
import { loadSiteCollectionIds } from '../../src/core/instance.js'
import type { Database } from '../../src/core/database.js'
import type { ExportContext, Gallery } from '../../src/core/types.js'
import type { Logger } from '../../src/core/logger.js'

const SELF = 'self-uuid'
const WITH_SITE = 'glass-uuid'
const WITHOUT_SITE = 'doubts-uuid'

const gallery: Gallery = {
  id: SELF,
  backwardCompatibility: 'mwnf3_thematic_gallery:thg_gallery:9',
  slug: 'carpets',
  host: 'https://carpets.museumwnf.org',
  mwnf3ProjectId: 'DCA',
  projectId: 'dca-project-uuid',
  anchor: {},
  chrome: {},
}

const itemRow = {
  id: 'item-a',
  type: 'object',
  internal_name: 'Item A',
  backward_compatibility: 'mwnf3_sharing_history:sh_objects:AWE:dz:6',
  parent_id: null,
  partner_id: null,
  country_id: null,
  project_id: 'awe-project-uuid',
  owner_reference: null,
  mwnf_reference: null,
  start_date: null,
  end_date: null,
  display_order: null,
  latitude: null,
  longitude: null,
}

const translationRow = (languageId: string, extra: Record<string, unknown>) => ({
  item_id: 'item-a',
  language_id: languageId,
  context_id: 'awe-context-uuid',
  name: 'Item A',
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
  extra,
  author_name: null,
  copy_editor_name: null,
  translator_name: null,
  translation_copy_editor_name: null,
})

const galleryRow = (collectionId: string, title: string) => ({
  item_id: 'item-a',
  collection_id: collectionId,
  collection_type: 'gallery',
  backward_compatibility: `mwnf3_thematic_gallery:thg_gallery:${title}`,
  internal_name: title,
  title,
  extra: { thg_gallery: { slug: title.toLowerCase(), host: null } },
})

describe('ItemExporter — other galleries and Sharing History artists', () => {
  let outputDir: string

  const stubDb = (rows: { translations?: unknown[]; galleries?: unknown[] }): Database =>
    ({
      query: async (sql: string) => {
        if (sql.includes('FROM languages')) {
          return [
            { id: 'eng', backward_compatibility: 'en' },
            { id: 'fra', backward_compatibility: 'fr' },
          ]
        }
        if (sql.includes('ORDER BY type, display_order, internal_name')) return [itemRow]
        if (sql.includes('ORDER BY it.item_id, it.context_id')) return rows.translations ?? []
        if (sql.includes('FROM collection_item ci')) return rows.galleries ?? []
        return []
      },
    }) as unknown as Database

  const context = (db: Database): ExportContext => ({
    db,
    outputDir,
    siteKey: 'carpets',
    gallery,
    memberItemIds: ['item-a'],
    itemOwnContextIds: new Map([['item-a', 'awe-context-uuid']]),
    siteCollectionIds: new Set([SELF, WITH_SITE]),
    baseUrl: 'https://example.test',
    logger: {
      info: () => {},
      success: () => {},
      warning: () => {},
      error: () => {},
    } as unknown as Logger,
  })

  const readJson = (file: string): Record<string, unknown> =>
    JSON.parse(readFileSync(join(outputDir, file), 'utf-8')) as Record<string, unknown>
  const readItem = (): Record<string, unknown> =>
    (JSON.parse(readFileSync(join(outputDir, 'items.json'), 'utf-8')) as Array<Record<string, unknown>>)[0]!

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'item-gallery-references-'))
  })

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true })
  })

  it('lists another gallery only when it has a website', async () => {
    const db = stubDb({
      galleries: [galleryRow(SELF, 'Carpets'), galleryRow(WITH_SITE, 'Glass'), galleryRow(WITHOUT_SITE, 'Doubts')],
    })
    await new ItemExporter(context(db)).export()

    const references = readItem().gallery_references as Array<Record<string, unknown>>
    expect(references.map(r => r.id)).toEqual([WITH_SITE])
  })

  it("exports a Sharing History record's artist in each language and on the item", async () => {
    const db = stubDb({
      translations: [
        translationRow('eng', { artist: 'Unknown', artist_birthdate: '1850', gallery_sheet: { description: 'EN' } }),
        translationRow('fra', { artist: 'Inconnu', artist_birthdate: '1850', gallery_sheet: { description: 'FR' } }),
      ],
    })
    await new ItemExporter(context(db)).export()

    expect(readItem().artist_names).toEqual(['Unknown'])
    const en = readJson('translations/items.en.json')['item-a'] as Record<string, unknown>
    const fr = readJson('translations/items.fr.json')['item-a'] as Record<string, unknown>
    expect(en.artist).toBe('Unknown')
    expect(fr.artist).toBe('Inconnu')
    expect(fr.artist_birthdate).toBe('1850')
  })
})

describe('sharingHistoryArtistNames', () => {
  it('takes the English spelling when there is one, else the first language', () => {
    expect(sharingHistoryArtistNames(new Map([['fr', 'Inconnu'], ['en', 'Unknown']]))).toEqual(['Unknown'])
    expect(sharingHistoryArtistNames(new Map([['it', 'Ignoto'], ['fr', 'Inconnu']]))).toEqual(['Inconnu'])
    expect(sharingHistoryArtistNames(undefined)).toEqual([])
  })
})

describe('loadSiteCollectionIds', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'instances-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('collects the collection of every gallery and exhibition site, and none for a standalone one', () => {
    writeFileSync(join(dir, 'glass.json'), JSON.stringify({ kind: 'gallery', collection_id: WITH_SITE }))
    writeFileSync(join(dir, 'water.json'), JSON.stringify({ kind: 'exhibition', collection_id: 'water-uuid' }))
    writeFileSync(join(dir, 'galleries.json'), JSON.stringify({ kind: 'standalone', exporter: 'galleries' }))
    writeFileSync(join(dir, 'README.md'), '# not an instance')

    expect([...loadSiteCollectionIds(dir)].sort()).toEqual([WITH_SITE, 'water-uuid'])
  })

  it("reads the repository's instance files", () => {
    const instances = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'instances')
    const ids = loadSiteCollectionIds(instances)
    const carpets = JSON.parse(readFileSync(join(instances, 'carpets.json'), 'utf-8')) as {
      collection_id: string
    }
    expect(ids.has(carpets.collection_id)).toBe(true)
  })
})

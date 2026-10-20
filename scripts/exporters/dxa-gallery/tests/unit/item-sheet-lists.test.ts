import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ItemExporter } from '../../src/exporters/item-exporter.js'
import type { Database } from '../../src/core/database.js'
import type { ExportContext, Gallery } from '../../src/core/types.js'
import type { Logger } from '../../src/core/logger.js'

/**
 * #2233 C23: the sheet's Material(s) / Technique(s) line is the record's own
 * column, per language, as legacy prints it. The material tags are shared
 * across records, so they give every record one spelling and lose the Arabic
 * list separator; they stay for the facets only.
 */
const gallery: Gallery = {
  id: 'self-uuid',
  backwardCompatibility: 'mwnf3_thematic_gallery:thg_gallery:9',
  slug: 'carpets',
  host: 'https://carpets.museumwnf.org',
  mwnf3ProjectId: 'DCA',
  projectId: 'dca-project-uuid',
  anchor: {},
  chrome: {},
}

const itemRow = (id: string, backwardCompatibility: string) => ({
  id,
  type: 'object',
  internal_name: id,
  backward_compatibility: backwardCompatibility,
  parent_id: null,
  partner_id: null,
  country_id: null,
  project_id: 'project-uuid',
  owner_reference: null,
  mwnf_reference: null,
  start_date: null,
  end_date: null,
  display_order: null,
  latitude: null,
  longitude: null,
})

const translationRow = (itemId: string, languageId: string, extra: Record<string, unknown> | null) => ({
  item_id: itemId,
  language_id: languageId,
  context_id: 'own-context-uuid',
  name: itemId,
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

const materialTag = (itemId: string, languageId: string, description: string) => ({
  item_id: itemId,
  tag_id: `tag-${description}`,
  category: 'material',
  language_id: languageId,
  description,
  backward_compatibility: `mwnf3:tags:material:${description}`,
})

describe('ItemExporter — materials and keywords as the record writes them', () => {
  let outputDir: string

  const stubDb = (rows: { items: unknown[]; translations: unknown[]; tags?: unknown[] }): Database =>
    ({
      query: async (sql: string) => {
        if (sql.includes('FROM languages')) {
          return [
            { id: 'eng', backward_compatibility: 'en' },
            { id: 'ara', backward_compatibility: 'ar' },
          ]
        }
        if (sql.includes('ORDER BY type, display_order, internal_name')) return rows.items
        if (sql.includes('ORDER BY it.item_id, it.context_id')) return rows.translations
        if (sql.includes('FROM item_tag it')) return rows.tags ?? []
        return []
      },
    }) as unknown as Database

  const context = (db: Database, memberItemIds: string[]): ExportContext => ({
    db,
    outputDir,
    siteKey: 'carpets',
    gallery,
    memberItemIds,
    itemOwnContextIds: new Map(memberItemIds.map(id => [id, 'own-context-uuid'])),
    siteCollectionIds: new Set(['self-uuid']),
    baseUrl: 'https://example.test',
    logger: {
      info: () => {},
      success: () => {},
      warning: () => {},
      error: () => {},
    } as unknown as Logger,
  })

  const readText = (lang: string, itemId: string): Record<string, unknown> =>
    (
      JSON.parse(readFileSync(join(outputDir, `translations/items.${lang}.json`), 'utf-8')) as Record<
        string,
        Record<string, unknown>
      >
    )[itemId]!

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'item-sheet-lists-'))
  })

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true })
  })

  it("prints an mwnf3 record's own materials column in each language, not the material tags", async () => {
    const db = stubDb({
      items: [itemRow('item-a', 'mwnf3:objects:epm:at:mus21:2')],
      translations: [
        translationRow('item-a', 'eng', { materials: 'Brass with decoration in niello-technique' }),
        translationRow('item-a', 'ara', { materials: 'نحاس أصفر؛ زخرفة بتقنية النيلو.' }),
      ],
      tags: [
        materialTag('item-a', 'eng', 'Brass'),
        materialTag('item-a', 'eng', 'Niello'),
        materialTag('item-a', 'ara', 'نحاس'),
      ],
    })
    await new ItemExporter(context(db, ['item-a'])).export()

    expect(readText('en', 'item-a').materials).toEqual(['Brass with decoration in niello-technique'])
    // One entry: the Arabic separator and the final period stay as written.
    expect(readText('ar', 'item-a').materials).toEqual(['نحاس أصفر؛ زخرفة بتقنية النيلو.'])
  })

  it("prints an mwnf3 record's own keywords column in each language, not the keyword tags", async () => {
    const db = stubDb({
      items: [itemRow('item-d', 'mwnf3:objects:isl:es:mus01:7')],
      translations: [
        translationRow('item-d', 'eng', { keywords: 'Marble; capital; Caliphate.' }),
        translationRow('item-d', 'ara', { keywords: 'رخام؛ تاج عمود؛ الخلافة.' }),
      ],
      tags: [
        { ...materialTag('item-d', 'eng', 'Marmól'), category: 'keyword' },
        { ...materialTag('item-d', 'ara', 'رخام'), category: 'keyword' },
      ],
    })
    await new ItemExporter(context(db, ['item-d'])).export()

    expect(readText('en', 'item-d').keywords).toEqual(['Marble; capital; Caliphate.'])
    expect(readText('ar', 'item-d').keywords).toEqual(['رخام؛ تاج عمود؛ الخلافة.'])
  })

  it('prints no materials line when the record has no materials column, whatever its tags', async () => {
    const db = stubDb({
      items: [itemRow('item-b', 'mwnf3:objects:dca:tr:mus01:5')],
      translations: [translationRow('item-b', 'eng', null)],
      tags: [materialTag('item-b', 'eng', 'Wool')],
    })
    await new ItemExporter(context(db, ['item-b'])).export()

    expect(readText('en', 'item-b').materials).toBeUndefined()
  })

  it("keeps a Sharing History record's keywords column whole, as dxa-api returned it", async () => {
    const db = stubDb({
      items: [itemRow('item-c', 'mwnf3_sharing_history:sh_objects:AWE:dz:6')],
      translations: [
        translationRow('item-c', 'eng', {
          materials: 'Paper, ink',
          gallery_sheet: { keywords: 'Hijaz Railway; Ottoman Empire; Pilgrimage' },
        }),
      ],
    })
    await new ItemExporter(context(db, ['item-c'])).export()

    const en = readText('en', 'item-c')
    expect(en.keywords).toEqual(['Hijaz Railway; Ottoman Empire; Pilgrimage'])
    expect(en.materials).toEqual(['Paper, ink'])
  })
})

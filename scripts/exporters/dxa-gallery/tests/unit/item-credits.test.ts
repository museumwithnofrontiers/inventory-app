import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ItemExporter } from '../../src/exporters/item-exporter.js'
import type { Database } from '../../src/core/database.js'
import type { ExportContext, Gallery } from '../../src/core/types.js'
import type { Logger } from '../../src/core/logger.js'

/**
 * The credits as the galleries' sheet (dxa-api) prints them: the credit table's
 * people, each kept apart for the site to print "Firstname LASTNAME", else the
 * row's own credit column as written. And a Sharing History record's fields,
 * read where the importer keeps them.
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

const translationRow = (
  id: string,
  itemId: string,
  languageId: string,
  fields: Record<string, unknown> = {},
  extra: Record<string, unknown> | null = null
) => ({
  id,
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
  ...fields,
})

describe('ItemExporter — credits and Sharing History fields as the galleries print them', () => {
  let outputDir: string

  const stubDb = (rows: { items: unknown[]; translations: unknown[]; credits?: unknown[] }): Database =>
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
        if (sql.includes('FROM item_translation_author ita')) return rows.credits ?? []
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
    logger: { info: () => {}, success: () => {}, warning: () => {}, error: () => {} } as unknown as Logger,
  })

  const readText = (lang: string, itemId: string): Record<string, unknown> =>
    (
      JSON.parse(readFileSync(join(outputDir, `translations/items.${lang}.json`), 'utf-8')) as Record<
        string,
        Record<string, unknown>
      >
    )[itemId]!

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'item-credits-'))
  })

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true })
  })

  it('keeps each credited person apart, in order, and in the original spelling on an Arabic row', async () => {
    const credit = (translationId: string, languageId: string, name: string, firstname: string, lastname: string, originalname = '') => ({
      item_translation_id: translationId,
      role: 'author',
      language_id: languageId,
      name,
      firstname,
      lastname,
      originalname,
    })
    const db = stubDb({
      items: [itemRow('item-a', 'mwnf3:objects:dca:jo:mus31_b:15')],
      translations: [translationRow('tr-en', 'item-a', 'eng'), translationRow('tr-ar', 'item-a', 'ara')],
      credits: [
        credit('tr-en', 'eng', 'Najd Sweidan', 'Najd', 'Sweidan'),
        credit('tr-en', 'eng', 'Samia Khouri', 'Samia', 'Khouri'),
        credit('tr-ar', 'ara', 'Najd Sweidan', 'Najd', 'Sweidan', 'نجد سويدان'),
      ],
    })
    await new ItemExporter(context(db, ['item-a'])).export()

    const en = readText('en', 'item-a')
    expect(en.author).toBe('Najd Sweidan, Samia Khouri')
    expect(en.credit_names).toEqual({
      author: [
        { firstname: 'Najd', lastname: 'Sweidan' },
        { firstname: 'Samia', lastname: 'Khouri' },
      ],
    })
    expect(readText('ar', 'item-a').credit_names).toEqual({ author: [{ name: 'نجد سويدان' }] })
  })

  it("falls back to the row's own credit column, as written, where the credit table has nobody", async () => {
    const db = stubDb({
      items: [itemRow('item-b', 'mwnf3:objects:isl:de:mus01:26')],
      translations: [
        translationRow('tr-ar', 'item-b', 'ara', {}, { credits_as_written: { author: 'أنيت هاغِِدورن.' } }),
      ],
    })
    await new ItemExporter(context(db, ['item-b'])).export()

    const ar = readText('ar', 'item-b')
    expect(ar.author).toBe('أنيت هاغِِدورن.')
    expect(ar.credit_names).toEqual({ author: [{ name: 'أنيت هاغِِدورن.' }] })
    expect(ar.credits_as_written).toBeUndefined()
  })

  it("reads a Sharing History record's second description and history where the importer keeps them", async () => {
    const db = stubDb({
      items: [itemRow('item-c', 'mwnf3_sharing_history:sh_monuments:awe:eg:3')],
      translations: [
        translationRow(
          'tr-en',
          'item-c',
          'eng',
          { description: 'The museum of Ancient Egyptian Agriculture…', alternate_name: 'Agricultural Museum' },
          { description2: 'A short text.', history: 'King Fu`ad I chose the palace…', dimensions: '47 x 30cm' }
        ),
      ],
    })
    await new ItemExporter(context(db, ['item-c'])).export()

    const en = readText('en', 'item-c')
    expect(en.description).toBe('The museum of Ancient Egyptian Agriculture…')
    expect(en.short_description).toBe('A short text.')
    expect(en.history).toBe('King Fu`ad I chose the palace…')
    expect(en.alternate_name).toBe('Agricultural Museum')
    expect(en.dimensions).toBe('47 x 30cm')
  })
})

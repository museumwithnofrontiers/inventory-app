import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ItemExporter } from '../../src/exporters/item-exporter.js'
import type { Database } from '../../src/core/database.js'
import type { ExportContext } from '../../src/core/types.js'
import type { Logger } from '../../src/core/logger.js'

/**
 * Legacy Islamic Art prints the record's own Material(s) / Technique(s)
 * column. The package used to build the line from the material tags, which
 * gather every material tag on the item: EPM records printed "Brass; Brass
 * with decoration in niello-technique; Niello" where legacy prints the one
 * phrase (#2233 C20).
 */
describe('ItemExporter — materials', () => {
  let outputDir: string

  const itemRow = {
    id: 'item-a',
    type: 'object',
    internal_name: 'Item A',
    backward_compatibility: 'mwnf3:objects:EPM:at:Mus21:2',
    parent_id: null,
    partner_id: null,
    country_id: null,
    collection_id: null,
    project_id: 'epm-project-uuid',
    owner_reference: null,
    mwnf_reference: null,
    start_date: null,
    end_date: null,
    display_order: null,
    latitude: null,
    longitude: null,
  }

  const translationRow = (languageId: string, extra: Record<string, unknown> | null) => ({
    item_id: 'item-a',
    language_id: languageId,
    context_id: 'epm-context-uuid',
    name: 'Bowl',
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

  const stubDb = (translations: unknown[]): Database =>
    ({
      query: async (sql: string) => {
        if (sql.includes('FROM languages')) return [{ id: 'eng', backward_compatibility: 'en' }]
        if (sql.includes('ORDER BY type, display_order, internal_name')) return [itemRow]
        if (sql.includes('FROM projects WHERE id IN')) {
          return [{ id: 'epm-project-uuid', context_id: 'epm-context-uuid' }]
        }
        if (sql.includes('ORDER BY it.item_id, it.context_id')) return translations
        if (sql.includes('FROM item_tag it2')) {
          return ['Brass', 'Brass with decoration in niello-technique', 'Niello'].map(tag => ({
            item_id: 'item-a',
            tag,
            category: 'material',
            language_id: 'eng',
          }))
        }
        return []
      },
    }) as unknown as Database

  const context = (db: Database): ExportContext => ({
    db,
    outputDir,
    projectIds: ['epm-project-uuid'],
    contextIds: ['epm-context-uuid'],
    projectKeys: ['EPM'],
    baseUrl: 'https://example.test',
    logger: {
      info: () => {},
      success: () => {},
      warning: () => {},
      error: () => {},
    } as unknown as Logger,
  })

  const readEnglish = (): Record<string, unknown> =>
    (JSON.parse(readFileSync(join(outputDir, 'translations', 'items.en.json'), 'utf-8')) as Record<
      string,
      Record<string, unknown>
    >)['item-a']!

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'islamicart-item-materials-'))
  })

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true })
  })

  it("prints the record's own materials line, not its material tags", async () => {
    const db = stubDb([translationRow('eng', { materials: 'Brass with decoration in niello-technique' })])
    await new ItemExporter(context(db)).export()

    expect(readEnglish().materials).toEqual(['Brass with decoration in niello-technique'])
  })

  it('prints no materials line when the record has none', async () => {
    const db = stubDb([translationRow('eng', null)])
    await new ItemExporter(context(db)).export()

    expect(readEnglish().materials).toEqual([])
  })

  // #2233 C23: the keywords follow the same rule as the materials.
  it("carries the record's own keywords column, as one entry", async () => {
    const db = stubDb([translationRow('eng', { keywords: 'Metalwork; niello; Mamluk.' })])
    await new ItemExporter(context(db)).export()

    expect(readEnglish().keywords).toEqual(['Metalwork; niello; Mamluk.'])
  })

  it('carries no keywords when the record has none', async () => {
    const db = stubDb([translationRow('eng', null)])
    await new ItemExporter(context(db)).export()

    expect(readEnglish().keywords).toEqual([])
  })
})

import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ItemExporter } from '../../src/exporters/item-exporter.js'
import type { Database } from '../../src/core/database.js'
import type { ExportContext } from '../../src/core/types.js'
import type { Logger } from '../../src/core/logger.js'

/**
 * Legacy Baroque Art prints the record's own Material(s) / Technique(s)
 * column, as written (`nl2br($cobj->materials_)`), in the page's language.
 * The package carried no materials line at all (#2233 C23).
 */
describe('ItemExporter — materials', () => {
  let outputDir: string

  const itemRow = {
    id: 'item-a',
    type: 'object',
    internal_name: 'Item A',
    backward_compatibility: 'mwnf3:objects:BAR:cz:Mus11:1',
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

  const translationRow = (languageId: string, extra: Record<string, unknown> | null) => ({
    item_id: 'item-a',
    language_id: languageId,
    context_id: 'bar-context-uuid',
    name: 'Monstrance',
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
        if (sql.includes('FROM languages')) {
          return [
            { id: 'eng', backward_compatibility: 'en' },
            { id: 'ces', backward_compatibility: 'cs' },
          ]
        }
        if (sql.includes('ORDER BY type, display_order, internal_name')) return [itemRow]
        if (sql.includes('FROM projects WHERE id IN')) {
          return [{ id: 'bar-project-uuid', context_id: 'bar-context-uuid' }]
        }
        if (sql.includes('ORDER BY it.item_id, it.context_id')) return translations
        return []
      },
    }) as unknown as Database

  const context = (db: Database): ExportContext => ({
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

  const readText = (lang: string): Record<string, unknown> =>
    (JSON.parse(readFileSync(join(outputDir, 'translations', `items.${lang}.json`), 'utf-8')) as Record<
      string,
      Record<string, unknown>
    >)['item-a']!

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'baroqueart-item-materials-'))
  })

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true })
  })

  it("prints the record's own materials line in each language, as written", async () => {
    const db = stubDb([
      translationRow('eng', { materials: 'Silver, gilded; enamel.' }),
      translationRow('ces', { materials: 'Stříbro, zlacené, smalt' }),
    ])
    await new ItemExporter(context(db)).export()

    expect(readText('en').materials).toEqual(['Silver, gilded; enamel.'])
    expect(readText('cs').materials).toEqual(['Stříbro, zlacené, smalt'])
  })

  it('prints no materials line when the record has none', async () => {
    const db = stubDb([translationRow('eng', null)])
    await new ItemExporter(context(db)).export()

    expect(readText('en').materials).toEqual([])
  })
})

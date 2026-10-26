import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ItemExporter } from '../../src/exporters/item-exporter.js'
import type { Database } from '../../src/core/database.js'
import type { ExportContext } from '../../src/core/types.js'
import type { Logger } from '../../src/core/logger.js'

/**
 * Legacy keeps an ISL record's two texts on one row: `description` (ISL, the
 * long one) and `description2` (EPM, the short one). The importer splits them
 * into an ISL-context and an EPM-context translation. Where a language has
 * only the EPM text (ISL;es;Mus01;26 in Arabic), legacy prints it as the short
 * description with no long one, so the package must too.
 */
describe('ItemExporter — short description', () => {
  let outputDir: string

  const itemRow = {
    id: 'item-a',
    type: 'object',
    internal_name: 'Chest',
    backward_compatibility: 'mwnf3:objects:ISL:es:Mus01:26',
    parent_id: null,
    partner_id: null,
    country_id: null,
    collection_id: null,
    project_id: 'isl-project-uuid',
    owner_reference: null,
    mwnf_reference: null,
    start_date: null,
    end_date: null,
    display_order: null,
    latitude: null,
    longitude: null,
  }

  const translationRow = (languageId: string, contextId: string, description: string) => ({
    item_id: 'item-a',
    language_id: languageId,
    context_id: contextId,
    name: 'Chest.',
    alternate_name: null,
    description,
    type: null,
    holder: 'National Archaeological Museum.',
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
    extra: null,
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
            { id: 'ara', backward_compatibility: 'ar' },
          ]
        }
        if (sql.includes('ORDER BY type, display_order, internal_name')) return [itemRow]
        if (sql.includes('FROM projects WHERE id IN')) {
          return [{ id: 'isl-project-uuid', context_id: 'isl-context-uuid' }]
        }
        if (sql.includes('ORDER BY it.item_id, it.context_id')) return translations
        return []
      },
    }) as unknown as Database

  const context = (db: Database): ExportContext => ({
    db,
    outputDir,
    projectIds: ['isl-project-uuid'],
    contextIds: ['isl-context-uuid', 'epm-context-uuid'],
    projectKeys: ['ISL'],
    baseUrl: 'https://example.test',
    logger: {
      info: () => {},
      success: () => {},
      warning: () => {},
      error: () => {},
    } as unknown as Logger,
  })

  const read = (lang: string): Record<string, unknown> =>
    (
      JSON.parse(
        readFileSync(join(outputDir, 'translations', `items.${lang}.json`), 'utf-8')
      ) as Record<string, Record<string, unknown>>
    )['item-a']!

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'islamicart-item-short-description-'))
  })

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true })
  })

  it('takes the long description from the own context and the short one from EPM', async () => {
    const db = stubDb([
      translationRow('eng', 'isl-context-uuid', 'Silver prismatic chest.'),
      translationRow('eng', 'epm-context-uuid', 'An unusual Andalusian chest.'),
    ])
    await new ItemExporter(context(db)).export()

    expect(read('en').description).toBe('Silver prismatic chest.')
    expect(read('en').short_description).toBe('An unusual Andalusian chest.')
  })

  it('prints an EPM-only language as the short description, with no long one', async () => {
    const db = stubDb([translationRow('ara', 'epm-context-uuid', 'صُنعت هذه القطعة من الفضة')])
    await new ItemExporter(context(db)).export()

    expect(read('ar')).not.toHaveProperty('description')
    expect(read('ar').short_description).toBe('صُنعت هذه القطعة من الفضة')
    expect(read('ar').holder).toBe('National Archaeological Museum.')
  })
})

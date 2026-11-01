import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ItemExporter } from '../../src/exporters/item-exporter.js'
import type { Database } from '../../src/core/database.js'
import type { ExportContext } from '../../src/core/types.js'
import type { Logger } from '../../src/core/logger.js'

/**
 * Legacy printed a record's Location lines from three columns: a monument's
 * address, the location and the province. The item sheet printed all three,
 * the Permanent Collection results tile only the location and the province.
 * The package carries each as it is, never joined, so the site composes each
 * line the way legacy did.
 */
describe('ItemExporter — location parts', () => {
  let outputDir: string

  const itemRow = {
    id: 'item-a',
    type: 'monument',
    internal_name: 'Dome of the Rock',
    backward_compatibility: 'mwnf3:monuments:ISL:pa:01',
    parent_id: null,
    partner_id: null,
    country_id: 'pse',
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

  const translationRow = (location: string | null, extra: Record<string, unknown> | null) => ({
    item_id: 'item-a',
    language_id: 'eng',
    context_id: 'isl-context-uuid',
    name: 'Dome of the Rock.',
    alternate_name: null,
    description: null,
    type: null,
    holder: null,
    owner: null,
    initial_owner: null,
    dates: null,
    location,
    dimensions: null,
    place_of_production: null,
    method_for_datation: null,
    method_for_provenance: null,
    provenance: null,
    obtention: null,
    bibliography: null,
    extra: extra ? JSON.stringify(extra) : null,
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
    contextIds: ['isl-context-uuid'],
    projectKeys: ['ISL'],
    baseUrl: 'https://example.test',
    logger: {
      info: () => {},
      success: () => {},
      warning: () => {},
      error: () => {},
    } as unknown as Logger,
  })

  const read = (): Record<string, unknown> =>
    (
      JSON.parse(readFileSync(join(outputDir, 'translations', 'items.en.json'), 'utf-8')) as Record<
        string,
        Record<string, unknown>
      >
    )['item-a']!

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'islamicart-item-location-parts-'))
  })

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true })
  })

  it('carries the address, the location and the province each as written', async () => {
    const db = stubDb([
      translationRow('Jerusalem.', {
        province: 'Al-Quds.',
        monument_contact: { address: 'Haram al-Sharif\nOld City.', phone: '+970 2 000 0000' },
      }),
    ])
    await new ItemExporter(context(db)).export()

    expect(read().location).toBe('Jerusalem.')
    expect(read().province).toBe('Al-Quds.')
    expect(read().address).toBe('Haram al-Sharif\nOld City.')
  })

  it('leaves out the parts a record does not have', async () => {
    const db = stubDb([translationRow('Jerusalem', null)])
    await new ItemExporter(context(db)).export()

    expect(read().location).toBe('Jerusalem')
    expect(read()).not.toHaveProperty('province')
    expect(read()).not.toHaveProperty('address')
  })
})

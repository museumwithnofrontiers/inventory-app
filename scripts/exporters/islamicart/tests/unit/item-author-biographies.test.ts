import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ItemExporter } from '../../src/exporters/item-exporter.js'
import type { Database } from '../../src/core/database.js'
import type { ExportContext } from '../../src/core/types.js'
import type { Logger } from '../../src/core/logger.js'

/**
 * Legacy's item sheet shows a credited person's biography beside their name
 * (modules/database_item.php's su_tooltip): their name in bold, then the
 * biography in the page's language. Each translation carries the ids of the
 * people it credits, per role, in the order its names print; authors.json and
 * translations/authors.<lang>.json carry those who have a biography.
 */
describe('ItemExporter — credited people and their biographies', () => {
  let outputDir: string

  const itemRow = {
    id: 'item-a',
    type: 'object',
    internal_name: 'Bowl',
    backward_compatibility: 'mwnf3:objects:ISL:se:Mus01:14',
    parent_id: null,
    partner_id: null,
    country_id: 'swe',
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

  const translationRow = {
    translation_id: 'tr-en',
    item_id: 'item-a',
    language_id: 'eng',
    context_id: 'isl-context-uuid',
    name: 'Bowl.',
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
    extra: null,
    author_name: 'Friederike Voigt',
    copy_editor_name: 'Monica Allen',
    translator_name: null,
    translation_copy_editor_name: null,
  }

  const queries: string[] = []
  const stubDb = (): Database =>
    ({
      query: async (sql: string) => {
        queries.push(sql)
        if (sql.includes('FROM languages')) {
          return [
            { id: 'eng', backward_compatibility: 'en' },
            { id: 'fra', backward_compatibility: 'fr' },
          ]
        }
        if (sql.includes('ORDER BY type, display_order, internal_name')) return [itemRow]
        if (sql.includes('FROM projects WHERE id IN')) return [{ id: 'isl-project-uuid', context_id: 'isl-context-uuid' }]
        if (sql.includes('ORDER BY it.item_id, it.context_id')) return [translationRow]
        if (sql.includes('FROM item_translation_author ita') && sql.includes('a.id AS author_id')) {
          return [
            { item_translation_id: 'tr-en', role: 'author', author_id: 'author-voigt' },
            { item_translation_id: 'tr-en', role: 'text_copy_editor', author_id: 'author-allen' },
          ]
        }
        if (sql.includes('FROM author_translations')) {
          return [
            { author_id: 'author-voigt', language_id: 'eng', curriculum: 'Friederike Voigt has an MA in Iranian studies.' },
            { author_id: 'author-voigt', language_id: 'fra', curriculum: 'Friederike Voigt has an MA in Iranian studies.' },
          ]
        }
        if (sql.includes('FROM authors')) {
          return [{ id: 'author-voigt', name: 'Friederike Voigt', firstname: 'Friederike', lastname: 'Voigt', originalname: 'فريدريك فويغت.' }]
        }
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

  const readJson = (...path: string[]): unknown => JSON.parse(readFileSync(join(outputDir, ...path), 'utf-8'))

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'islamicart-item-authors-'))
    queries.length = 0
  })

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true })
  })

  it('carries the ids of the credited people per role, in the order their names print', async () => {
    await new ItemExporter(context(stubDb())).export()

    const items = readJson('translations', 'items.en.json') as Record<string, Record<string, unknown>>
    expect(items['item-a']!.author).toBe('Friederike Voigt')
    expect(items['item-a']!.credit_ids).toEqual({ author: ['author-voigt'], copy_editor: ['author-allen'] })
    // Same order and filter as the printed names: an Arabic row credits only those with an Arabic spelling.
    const credits = queries.find(sql => sql.includes('a.id AS author_id'))!
    expect(credits).toContain("it.language_id <> 'ara' OR NULLIF(a.originalname, '') IS NOT NULL")
    expect(credits).toContain('ORDER BY ita.item_translation_id, ita.role, ita.display_order, a.name')
  })

  it('writes the people with a biography and their biography per language', async () => {
    await new ItemExporter(context(stubDb())).export()

    expect(readJson('authors.json')).toEqual([
      { id: 'author-voigt', name: 'Friederike Voigt', firstname: 'Friederike', lastname: 'Voigt', originalname: 'فريدريك فويغت.' },
    ])
    expect(readJson('translations', 'authors.en.json')).toEqual({
      'author-voigt': { curriculum: 'Friederike Voigt has an MA in Iranian studies.' },
    })
    expect(readJson('translations', 'authors.fr.json')).toHaveProperty('author-voigt')
    // Only this project's context, and only a biography that says something.
    const cvs = queries.find(sql => sql.includes('FROM author_translations'))!
    expect(cvs).toContain('context_id IN')
    expect(cvs).toContain("NULLIF(TRIM(curriculum), '') IS NOT NULL")
  })

  it('writes no authors for a mini-site, whose package prints no credits', async () => {
    const ctx = { ...context(stubDb()), scope: { itemIds: ['item-a'], collectionIds: [] } } as unknown as ExportContext
    await new ItemExporter(ctx).export()

    expect(existsSync(join(outputDir, 'authors.json'))).toBe(false)
    const items = readJson('translations', 'items.en.json') as Record<string, Record<string, unknown>>
    expect(items['item-a']).not.toHaveProperty('credit_ids')
  })
})

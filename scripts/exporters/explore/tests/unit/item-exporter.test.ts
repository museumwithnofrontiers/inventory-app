import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ItemExporter } from '../../src/exporters/item-exporter.js'
import type { Database } from '../../src/core/database.js'
import { contextWith, scopeWith } from './support.js'

/**
 * Most Explore monuments are other databases' records: a monument's content
 * is its own context's translation (its project's, or Travels' for a record
 * with no project), and Explore's own name and texts for it ship apart, as
 * `explore`. A monument native to Explore has only Explore's translation, which
 * is then its content.
 */
describe('ItemExporter — Explore translations', () => {
  let outputDir: string

  const item = (id: string, project_id: string | null) => ({
    id,
    type: 'monument',
    internal_name: id,
    backward_compatibility: id,
    parent_id: null,
    partner_id: null,
    country_id: null,
    collection_id: null,
    project_id,
    owner_reference: null,
    mwnf_reference: null,
    start_date: null,
    end_date: null,
    display_order: null,
    latitude: null,
    longitude: null,
  })

  const translation = (
    item_id: string,
    context_id: string,
    name: string,
    description: string | null = null,
    extra: unknown = null
  ) => ({
    item_id,
    language_id: 'eng',
    context_id,
    name,
    alternate_name: null,
    description,
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

  const db = {
    query: async (sql: string) => {
      if (sql.includes('ORDER BY type, display_order, internal_name')) {
        return [item('baroque', 'bar'), item('travels', null), item('native', null)]
      }
      if (sql.includes('SELECT id, context_id FROM projects'))
        return [{ id: 'bar', context_id: 'bar-context' }]
      if (sql.includes('FROM languages')) return [{ id: 'eng', backward_compatibility: 'en' }]
      if (sql.includes('FROM item_tag')) {
        return [
          { item_id: 'travels', tag: 'Manueline', category: 'filter' },
          { item_id: 'travels', tag: 'monastery', category: 'keyword' },
          { item_id: 'travels', tag: 'Religious', category: 'filter' },
        ]
      }
      if (sql.includes('LEFT JOIN authors')) {
        return [
          translation(
            'baroque',
            'bar-context',
            'Jesuitenkirche Innsbruck',
            'Das Innsbrucker Jesuitenkolleg'
          ),
          translation('baroque', 'explore-context', 'Jesuit Church Innsbruck'),
          translation('native', 'explore-context', 'Fuwa mosque', 'A mosque', {
            how_to_reach: 'By road',
          }),
          translation('travels', 'explore-context', 'Monastery of Jeronimos'),
          translation('travels', 'travels-context', 'Monastery of Jerónimos', 'The monastery', {
            prepared_by: 'Pedro Dias',
          }),
        ]
      }
      return []
    },
  } as unknown as Database

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'explore-items-'))
  })

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true })
  })

  it("ships each monument's own content, and Explore's texts apart", async () => {
    await new ItemExporter(
      contextWith(
        db,
        outputDir,
        scopeWith({
          itemIds: ['baroque', 'travels', 'native'],
          projectIds: ['bar'],
          contextIds: ['explore-context', 'bar-context', 'travels-context'],
        })
      )
    ).export()

    const english = JSON.parse(
      readFileSync(join(outputDir, 'translations', 'items.en.json'), 'utf-8')
    )
    expect(english.baroque).toEqual({
      name: 'Jesuitenkirche Innsbruck',
      description: 'Das Innsbrucker Jesuitenkolleg',
      explore: { name: 'Jesuit Church Innsbruck' },
    })
    expect(english.travels).toEqual({
      name: 'Monastery of Jerónimos',
      description: 'The monastery',
      prepared_by: 'Pedro Dias',
      explore: { name: 'Monastery of Jeronimos' },
    })
    expect(english.native).toEqual({
      name: 'Fuwa mosque',
      description: 'A mosque',
      how_to_reach: 'By road',
    })

    const items = JSON.parse(readFileSync(join(outputDir, 'items.json'), 'utf-8'))
    expect(items.map((i: { id: string; languages: string[] }) => [i.id, i.languages])).toEqual([
      ['baroque', ['en']],
      ['travels', ['en']],
      ['native', ['en']],
    ])
  })

  it('ships the Explore filters apart from the other tags', async () => {
    await new ItemExporter(
      contextWith(
        db,
        outputDir,
        scopeWith({
          itemIds: ['baroque', 'travels', 'native'],
          projectIds: ['bar'],
          contextIds: ['explore-context', 'bar-context', 'travels-context'],
        })
      )
    ).export()

    const items = JSON.parse(readFileSync(join(outputDir, 'items.json'), 'utf-8'))
    const travels = items.find((i: { id: string }) => i.id === 'travels')
    expect(travels.tags).toEqual(['Manueline', 'monastery', 'Religious'])
    expect(travels.filters).toEqual(['Manueline', 'Religious'])
  })
})

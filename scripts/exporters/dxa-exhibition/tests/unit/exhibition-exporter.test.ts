import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ExhibitionExporter } from '../../src/exporters/exhibition-exporter.js'
import type { Database } from '../../src/core/database.js'
import type { ExportContext, Exhibition } from '../../src/core/types.js'
import type { Logger } from '../../src/core/logger.js'

/**
 * Epic #1727 phase 2 follow-up: `exhibition.json` is the site anchor —
 * itself a `collections` row — and carried only the legacy
 * `mwnf3_project_id`. `manifest.projects` and every other consumer resolving
 * a project by UUID need the exhibition's own `project_id` right here too,
 * next to the legacy key (the UUID was already resolved onto
 * `Exhibition.projectId`, just never copied onto this output).
 */
describe('ExhibitionExporter — project_id', () => {
  let outputDir: string

  const exhibition: Exhibition = {
    id: 'exhibition-uuid',
    backwardCompatibility: 'mwnf3_thematic_gallery:thg_gallery:47',
    slug: 'the_use_of_colours_in_art',
    host: 'https://the-use-of-colours-in-art.museumwnf.org',
    mwnf3ProjectId: 'EXHCOLOUR',
    projectId: 'exhcolour-project-uuid',
    anchor: {},
    chrome: {},
    i18n: new Map(),
  }

  const stubDb = (): Database =>
    ({
      query: async () => [],
    }) as unknown as Database

  const context = (db: Database): ExportContext => ({
    db,
    outputDir,
    exhibition,
    themes: [],
    memberItemIds: [],
    itemOwnContextIds: new Map(),
    baseUrl: 'https://example.test',
    logger: {
      info: () => {},
      success: () => {},
      warning: () => {},
      error: () => {},
    } as unknown as Logger,
    siteKey: 'the-use-of-colours-in-art',
  })

  const readOutput = (): Record<string, unknown> =>
    JSON.parse(readFileSync(join(outputDir, 'exhibition.json'), 'utf-8')) as Record<string, unknown>

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'colours-exhibition-exporter-'))
  })

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true })
  })

  it('carries the exhibition own project_id (UUID) alongside the legacy mwnf3_project_id', async () => {
    const db = stubDb()
    await new ExhibitionExporter(context(db)).export()

    const output = readOutput()
    expect(output.mwnf3_project_id).toBe('EXHCOLOUR')
    expect(output.project_id).toBe('exhcolour-project-uuid')
  })

  it('reports null project_id for an exhibition with no mwnf3 project', async () => {
    const noProjectExhibition: Exhibition = { ...exhibition, mwnf3ProjectId: null, projectId: null }
    const db = stubDb()
    await new ExhibitionExporter({ ...context(db), exhibition: noProjectExhibition }).export()

    const output = readOutput()
    expect(output.mwnf3_project_id).toBeNull()
    expect(output.project_id).toBeNull()
  })
})

/**
 * Story #1943: an instance's `languagesEnabled` override is authoritative
 * over `exhibition_i18n.enabled` when set, for a site whose legacy record
 * enables the wrong (or no) languages.
 */
describe('ExhibitionExporter — languages_enabled override', () => {
  let outputDir: string

  const exhibition: Exhibition = {
    id: 'exhibition-uuid',
    backwardCompatibility: 'mwnf3_thematic_gallery:thg_gallery:55',
    slug: 'lost_memories',
    host: 'https://exhibitions.museumwnf.org',
    mwnf3ProjectId: 'GalEx5',
    projectId: null,
    anchor: {},
    chrome: {},
    i18n: new Map(),
  }

  const dbWithLanguages = (
    languages: { id: string; backward_compatibility: string }[],
    translations: { collection_id: string; language_id: string; title: string | null; description: string | null }[] = []
  ): Database =>
    ({
      query: async (sql: string) => {
        if (sql.includes('FROM languages')) return languages
        if (sql.includes('FROM collection_translations')) return translations
        return []
      },
    }) as unknown as Database

  const context = (db: Database): ExportContext => ({
    db,
    outputDir,
    exhibition,
    themes: [],
    memberItemIds: [],
    itemOwnContextIds: new Map(),
    baseUrl: 'https://example.test',
    logger: {
      info: () => {},
      success: () => {},
      warning: () => {},
      error: () => {},
    } as unknown as Logger,
    siteKey: 'the-hijaz-railway',
  })

  const readOutput = (): Record<string, unknown> =>
    JSON.parse(readFileSync(join(outputDir, 'exhibition.json'), 'utf-8')) as Record<string, unknown>

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'hijaz-exhibition-exporter-'))
  })

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true })
  })

  it('derives languages_enabled from exhibition_i18n.enabled when no override is set', async () => {
    const db = dbWithLanguages(
      [{ id: 'eng', backward_compatibility: 'en' }],
      [{ collection_id: 'exhibition-uuid', language_id: 'eng', title: 'Title', description: null }]
    )
    const enabledExhibition: Exhibition = { ...exhibition, i18n: new Map([['eng', { enabled: 'Y' }]]) }

    await new ExhibitionExporter({ ...context(db), exhibition: enabledExhibition }).export()

    expect(readOutput().languages_enabled).toEqual(['en'])
  })

  it('takes languages_enabled from the instance override, ignoring the legacy enabled flag', async () => {
    const db = dbWithLanguages(
      [{ id: 'eng', backward_compatibility: 'en' }],
      [{ collection_id: 'exhibition-uuid', language_id: 'eng', title: 'Title', description: null }]
    )
    // Legacy enables nothing for this record — the override still ships 'en'.
    const noneEnabledExhibition: Exhibition = { ...exhibition, i18n: new Map([['eng', { enabled: 'N' }]]) }

    await new ExhibitionExporter({
      ...context(db),
      exhibition: noneEnabledExhibition,
      languagesEnabled: ['en'],
    }).export()

    expect(readOutput().languages_enabled).toEqual(['en'])
  })

  it('rejects an override code the exhibition does not know', async () => {
    const db = dbWithLanguages([{ id: 'eng', backward_compatibility: 'en' }])

    await expect(
      new ExhibitionExporter({ ...context(db), languagesEnabled: ['xx'] }).export()
    ).rejects.toThrow('xx')
  })
})

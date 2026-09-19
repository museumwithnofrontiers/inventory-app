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
    itemProjectKeys: new Map(),
    itemOwnContextIds: new Map(),
    baseUrl: 'https://example.test',
    logger: {
      info: () => {},
      success: () => {},
      warning: () => {},
      error: () => {},
    } as unknown as Logger,
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

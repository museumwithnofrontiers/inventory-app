import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { GalleryExporter } from '../../src/exporters/gallery-exporter.js'
import type { Database } from '../../src/core/database.js'
import type { ExportContext, Gallery } from '../../src/core/types.js'
import type { Logger } from '../../src/core/logger.js'

/**
 * Epic #1727 phase 2 follow-up: `gallery.json` is the site anchor — itself a
 * `collections` row — and carried only the legacy `mwnf3_project_id`.
 * `manifest.projects` and every other consumer resolving a project by UUID
 * need the gallery's own `project_id` right here too, next to the legacy key
 * (the UUID was already resolved onto `Gallery.projectId`, just never copied
 * onto this output).
 */
describe('GalleryExporter — project_id', () => {
  let outputDir: string

  const gallery: Gallery = {
    id: 'gallery-uuid',
    backwardCompatibility: 'mwnf3_thematic_gallery:thg_gallery:4',
    slug: 'amulets_and_talismans',
    host: 'https://amulets.museumwnf.org',
    mwnf3ProjectId: 'AMU',
    projectId: 'amu-project-uuid',
    anchor: {},
    chrome: {},
  }

  const stubDb = (): Database =>
    ({
      query: async () => [],
    }) as unknown as Database

  const context = (db: Database): ExportContext => ({
    db,
    outputDir,
    gallery,
    memberItemIds: [],
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
    JSON.parse(readFileSync(join(outputDir, 'gallery.json'), 'utf-8')) as Record<string, unknown>

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'amulets-gallery-exporter-'))
  })

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true })
  })

  it('carries the gallery own project_id (UUID) alongside the legacy mwnf3_project_id', async () => {
    const db = stubDb()
    await new GalleryExporter(context(db)).export()

    const output = readOutput()
    expect(output.mwnf3_project_id).toBe('AMU')
    expect(output.project_id).toBe('amu-project-uuid')
  })

  it('reports null project_id for a gallery with no mwnf3 project', async () => {
    const noProjectGallery: Gallery = { ...gallery, mwnf3ProjectId: null, projectId: null }
    const db = stubDb()
    await new GalleryExporter({ ...context(db), gallery: noProjectGallery }).export()

    const output = readOutput()
    expect(output.mwnf3_project_id).toBeNull()
    expect(output.project_id).toBeNull()
  })
})

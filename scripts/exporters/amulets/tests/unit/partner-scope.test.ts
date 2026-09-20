import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { PartnerExporter } from '../../src/exporters/partner-exporter.js'
import type { Database } from '../../src/core/database.js'
import type { ExportContext, Gallery } from '../../src/core/types.js'
import type { Logger } from '../../src/core/logger.js'

/**
 * The third branch of legacy's partner query (MWNF-384) selects nobody on
 * amulets — no `mwnf3.museums` row has `project_id = 'AMU'`, and the export is
 * 26 partners with or without it. It is implemented anyway, because this fork
 * is what the next gallery exporter is copied from and the branch is NOT inert
 * generally (carpets goes 70 → 72 on it).
 *
 * That makes the branch invisible to a count check here, so these cases pin its
 * shape instead: a LEFT JOIN (an inner join drops a partner with no member
 * item), a museum-only predicate (`partners.project_id` is also set on ISL
 * schools), and a project id bound from the gallery rather than written into
 * the SQL.
 */
describe('PartnerExporter — MWNF-384 scope', () => {
  let outputDir: string
  let queries: { sql: string; params: unknown }[]

  const gallery = (projectId: string | null): Gallery => ({
    id: 'gallery-uuid',
    backwardCompatibility: 'mwnf3_thematic_gallery:thg_gallery:4',
    slug: 'amulets_and_talismans',
    host: 'https://amulets.museumwnf.org',
    mwnf3ProjectId: 'AMU',
    projectId,
    anchor: {},
    chrome: {},
  })

  const stubDb = (): Database =>
    ({
      query: async (sql: string, params?: unknown) => {
        queries.push({ sql, params })
        if (sql.includes('FROM languages')) return [{ id: 'eng', backward_compatibility: 'en' }]
        return []
      },
    }) as unknown as Database

  const context = (projectId: string | null): ExportContext => ({
    db: stubDb(),
    outputDir,
    gallery: gallery(projectId),
    memberItemIds: ['item-a', 'item-b'],
    itemOwnContextIds: new Map(),
    baseUrl: 'https://example.test',
    logger: {
      info: () => {},
      success: () => {},
      warning: () => {},
      error: () => {},
    } as unknown as Logger,
  })

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'amulets-partners-'))
    queries = []
  })

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true })
  })

  it('selects the third branch by the gallery project id, never a literal code', async () => {
    await new PartnerExporter(context('project-amu-uuid')).export()

    const partnerQuery = queries[0]
    expect(partnerQuery.sql).toContain('LEFT JOIN items')
    expect(partnerQuery.sql).toContain("p.type = 'museum' AND p.project_id = ?")
    expect(partnerQuery.sql).not.toContain('AMU')
    expect(partnerQuery.params).toEqual(['item-a', 'item-b', 'project-amu-uuid'])
  })

  it('binds null for a gallery with no project, leaving the branch inert', async () => {
    await new PartnerExporter(context(null)).export()

    expect(queries[0].params).toEqual(['item-a', 'item-b', null])
  })
})

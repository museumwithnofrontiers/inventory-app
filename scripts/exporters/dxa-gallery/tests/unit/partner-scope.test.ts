import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { PartnerExporter } from '../../src/exporters/partner-exporter.js'
import type { Database } from '../../src/core/database.js'
import type { ExportContext, Gallery } from '../../src/core/types.js'
import type { Logger } from '../../src/core/logger.js'

/**
 * Legacy's partner list (app/MWNF/SQL/mwnf3/Partners.blade.php) is a
 * three-branch UNION, and the third — MWNF-384 — lists museums created in the
 * gallery's own project even when they hold nothing. Carpets is the gallery
 * where it fires: without it the package ships 70 partners against legacy's 72.
 *
 * These cases pin the branch at the query level, where the mistake would be
 * silent: an inner join, or a hardcoded project code, still exports a
 * plausible-looking file that is short by exactly the museums nobody filled.
 */
describe('PartnerExporter — MWNF-384 scope', () => {
  let outputDir: string
  let queries: { sql: string; params: unknown }[]

  const gallery = (projectId: string | null): Gallery => ({
    id: 'gallery-uuid',
    backwardCompatibility: 'mwnf3_thematic_gallery:thg_gallery:9',
    slug: 'carpets',
    host: 'https://carpets.museumwnf.org',
    mwnf3ProjectId: projectId === null ? null : 'DCA',
    projectId,
    anchor: {},
    chrome: {},
  })

  /** Two partners: one holding two members, one holding nothing (MWNF-384). */
  const partnerRows = [
    {
      id: 'partner-holder',
      type: 'museum',
      internal_name: 'A holder',
      backward_compatibility: 'mwnf3:museums:Mus31:uk',
      country_id: 'gbr',
      latitude: null,
      longitude: null,
      map_zoom: 16,
      monument_item_id: null,
      item_count: 2,
    },
    {
      id: 'partner-orphan',
      type: 'museum',
      internal_name: 'Greater Amman Municipality',
      backward_compatibility: 'mwnf3:museums:Mus31:jo',
      country_id: 'jor',
      latitude: null,
      longitude: null,
      map_zoom: 16,
      monument_item_id: null,
      item_count: 0,
    },
  ]

  const stubDb = (partners: unknown[]): Database =>
    ({
      query: async (sql: string, params?: unknown) => {
        queries.push({ sql, params })
        if (sql.includes('FROM partners')) return partners
        if (sql.includes('FROM languages')) return [{ id: 'eng', backward_compatibility: 'en' }]
        if (sql.includes('FROM partner_translations')) {
          return partners.map(p => ({
            partner_id: (p as { id: string }).id,
            language_id: 'eng',
            name: (p as { internal_name: string }).internal_name,
            description: null,
            city_display: null,
            address_notes: null,
            contact_website: null,
            contact_phone: null,
            contact_email_general: null,
            extra: null,
          }))
        }
        return []
      },
    }) as unknown as Database

  const context = (partners: unknown[], projectId: string | null): ExportContext => ({
    db: stubDb(partners),
    outputDir,
    siteKey: 'carpets',
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

  const readOutput = () =>
    JSON.parse(readFileSync(join(outputDir, 'partners.json'), 'utf-8')) as {
      backward_compatibility: string
      item_count: number
    }[]

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'carpets-partners-'))
    queries = []
  })

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true })
  })

  it('keeps a museum of the gallery project that holds no member item', async () => {
    const result = await new PartnerExporter(context(partnerRows, 'project-dca-uuid')).export()

    expect(result.count).toBe(2)
    const output = readOutput()
    expect(output.map(p => p.backward_compatibility)).toEqual([
      'mwnf3:museums:Mus31:uk',
      'mwnf3:museums:Mus31:jo',
    ])
    // The zero is the whole point: legacy ships these with hasObjects: 0.
    expect(output.find(p => p.backward_compatibility === 'mwnf3:museums:Mus31:jo')?.item_count).toBe(
      0
    )
  })

  it('selects the third branch by the gallery project id, never a literal code', async () => {
    await new PartnerExporter(context(partnerRows, 'project-dca-uuid')).export()

    const partnerQuery = queries[0]
    expect(partnerQuery.sql).toContain('LEFT JOIN items')
    expect(partnerQuery.sql).toContain("p.type = 'museum' AND p.project_id = ?")
    expect(partnerQuery.sql).not.toContain('DCA')
    // The member ids first, the gallery's project id last.
    expect(partnerQuery.params).toEqual(['item-a', 'item-b', 'project-dca-uuid'])
  })

  /**
   * `p.project_id = NULL` is never true, so a gallery with no mwnf3 project
   * (43, 45) — or one whose project owns no museum, which is amulets — falls
   * back to exactly the two "holds a member item" branches.
   */
  it('binds null for a gallery with no project, leaving the branch inert', async () => {
    const result = await new PartnerExporter(context([partnerRows[0]], null)).export()

    expect(queries[0].params).toEqual(['item-a', 'item-b', null])
    expect(result.count).toBe(1)
  })

  it('exports nothing at all when the gallery has no member items', async () => {
    const ctx = { ...context([], 'project-dca-uuid'), memberItemIds: [] }
    const result = await new PartnerExporter(ctx).export()

    expect(result.count).toBe(0)
    expect(queries).toHaveLength(0)
  })
})

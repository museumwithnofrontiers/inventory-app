import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { PartnerExporter } from '../../src/exporters/partner-exporter.js'
import type { Database } from '../../src/core/database.js'
import type { ExportContext, Exhibition } from '../../src/core/types.js'
import type { Logger } from '../../src/core/logger.js'

/**
 * Legacy's partner list (app/MWNF/SQL/mwnf3/Partners.blade.php) is a
 * three-branch UNION whose third branch — MWNF-384 — lists museums created in
 * the site's own project even when they hold nothing, and whose final CTE drops
 * two partners by name.
 *
 * These cases pin both at the QUERY level, which is where either mistake would
 * be silent: an inner join, a hardcoded project code, or a forgotten exclusion
 * all still export a plausible-looking file, short or long by exactly the rows
 * nobody counted.
 */
describe('PartnerExporter — MWNF-384 scope and legacy exclusions', () => {
  let outputDir: string
  let queries: { sql: string; params: unknown }[]

  const exhibition = (projectId: string | null): Exhibition => ({
    id: 'gallery-uuid',
    backwardCompatibility: 'mwnf3_thematic_gallery:thg_gallery:47',
    slug: 'the_use_of_colours_in_art',
    host: 'https://exhibitions.museumwnf.org',
    mwnf3ProjectId: projectId === null ? null : 'EXHCOLOUR',
    projectId,
    anchor: {},
    i18n: new Map(),
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
    exhibition: exhibition(projectId),
    themes: [],
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
    outputDir = mkdtempSync(join(tmpdir(), 'the-use-of-colours-in-art-partners-'))
    queries = []
  })

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true })
  })

  it('keeps a museum of the gallery project that holds no member item', async () => {
    const result = await new PartnerExporter(context(partnerRows, 'project-exhcolour-uuid')).export()

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
    await new PartnerExporter(context(partnerRows, 'project-exhcolour-uuid')).export()

    const partnerQuery = queries[0]
    expect(partnerQuery.sql).toContain('LEFT JOIN items')
    expect(partnerQuery.sql).toContain("p.type = 'museum' AND p.project_id = ?")
    expect(partnerQuery.sql).not.toContain('EXHCOLOUR')
    // Member ids, then the exhibition's project id, then the two exclusions.
    expect(partnerQuery.params).toEqual([
      'item-a',
      'item-b',
      'project-exhcolour-uuid',
      'mwnf3:museums:Mus51:uk',
      'mwnf3:museums:Mus51:us',
    ])
  })

  /**
   * Legacy's final CTE drops uk/Mus51 and us/Mus51 by name from every DXA
   * partner list. It matched nothing on amulets or carpets, so the first two
   * forks recorded the rule and skipped it; on this exhibition both rows hold
   * member items (6 and 17), and omitting the filter ships 77 museums where
   * legacy shows 75.
   */
  it("drops legacy's two hardcoded exclusions even though they hold member items", async () => {
    const withExcluded = [
      ...partnerRows,
      {
        id: 'partner-mus51-uk',
        type: 'museum',
        internal_name: 'Excluded UK',
        backward_compatibility: 'mwnf3:museums:Mus51:uk',
        country_id: 'gbr',
        latitude: null,
        longitude: null,
        map_zoom: 16,
        monument_item_id: null,
        item_count: 6,
      },
    ]

    await new PartnerExporter(context(withExcluded, 'project-exhcolour-uuid')).export()

    // The filter belongs in the query, not in a post-filter: the exporter must
    // never load them and then forget to drop them.
    const partnerQuery = queries[0]
    expect(partnerQuery.sql).toContain('p.backward_compatibility NOT IN')
    expect(partnerQuery.params).toContain('mwnf3:museums:Mus51:uk')
    expect(partnerQuery.params).toContain('mwnf3:museums:Mus51:us')
  })

  /**
   * A partner with no legacy key must survive the exclusion clause: `NOT IN`
   * over a NULL column yields NULL, which is not TRUE, so an unguarded filter
   * silently drops every partner the importer created without one.
   */
  it('keeps a partner that has no backward_compatibility at all', async () => {
    const partnerQuerySql = () => queries[0].sql as string
    await new PartnerExporter(context(partnerRows, 'project-exhcolour-uuid')).export()
    expect(partnerQuerySql()).toContain('p.backward_compatibility IS NULL')
  })

  /**
   * `p.project_id = NULL` is never true, so a gallery with no mwnf3 project
   * (43, 45) — or one whose project owns no museum, which is amulets — falls
   * back to exactly the two "holds a member item" branches.
   */
  it('binds null for a gallery with no project, leaving the branch inert', async () => {
    const result = await new PartnerExporter(context([partnerRows[0]], null)).export()

    expect(queries[0].params).toEqual([
      'item-a',
      'item-b',
      null,
      'mwnf3:museums:Mus51:uk',
      'mwnf3:museums:Mus51:us',
    ])
    expect(result.count).toBe(1)
  })

  it('exports nothing at all when the gallery has no member items', async () => {
    const ctx = { ...context([], 'project-exhcolour-uuid'), memberItemIds: [] }
    const result = await new PartnerExporter(ctx).export()

    expect(result.count).toBe(0)
    expect(queries).toHaveLength(0)
  })
})

import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { PartnerExporter } from '../../src/exporters/partner-exporter.js'
import type { Database } from '../../src/core/database.js'
import type { ExportContext, Gallery, Partner } from '../../src/core/types.js'
import type { Logger } from '../../src/core/logger.js'

/**
 * Every dataset's partners.json carries the same five fields — level,
 * parent_id, project_ids, item_count, featured (decision D4,
 * metanull/inventory-app#1699). This fork already had item_count/featured;
 * these cases pin the three fields it adds — level, parent_id, project_ids —
 * derived from the same curated collection_partner hierarchy the
 * project-scoped exporters read, scoped to the gallery's own single project,
 * plus their empty defaults so a partner the hierarchy has nothing to say
 * about still reports a value rather than an absent key.
 */
describe('PartnerExporter — shared partner shape', () => {
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

  const partnerRow = (id: string, itemCount: number) => ({
    id,
    type: 'museum',
    internal_name: `Museum ${id}`,
    backward_compatibility: `mwnf3:museums:${id}`,
    country_id: 'gbr',
    latitude: null,
    longitude: null,
    map_zoom: 16,
    monument_item_id: null,
    item_count: itemCount,
  })

  const translationRow = (partnerId: string) => ({
    partner_id: partnerId,
    language_id: 'eng',
    name: `Partner ${partnerId}`,
    description: null,
    city_display: null,
    address_notes: null,
    contact_website: null,
    contact_phone: null,
    contact_email_general: null,
    extra: null,
  })

  const stubDb = (rows: {
    partners: unknown[]
    levels?: unknown[]
    groupMemberships?: unknown[]
    heldItems?: unknown[]
  }): Database =>
    ({
      query: async (sql: string, params?: unknown) => {
        queries.push({ sql, params })
        if (sql.includes('FROM partners')) return rows.partners
        if (sql.includes('FROM languages')) return [{ id: 'eng', backward_compatibility: 'en' }]
        if (sql.includes('FROM partner_translations')) {
          return rows.partners.map(p => translationRow((p as { id: string }).id))
        }
        if (sql.includes('FROM partner_images')) return []
        if (sql.includes('FROM partner_logos')) return []
        if (sql.includes("cp.collection_type = 'project'")) return rows.levels ?? []
        if (sql.includes("cp.collection_type = 'collection'")) return rows.groupMemberships ?? []
        if (sql.includes('AS item_id')) return rows.heldItems ?? []
        return []
      },
    }) as unknown as Database

  const context = (
    db: Database,
    projectId: string | null,
    itemProjectKeys: Map<string, string> = new Map()
  ): ExportContext => ({
    db,
    outputDir,
    gallery: gallery(projectId),
    memberItemIds: ['item-a', 'item-b'],
    itemProjectKeys,
    itemOwnContextIds: new Map(),
    baseUrl: 'https://example.test',
    logger: {
      info: () => {},
      success: () => {},
      warning: () => {},
      error: () => {},
    } as unknown as Logger,
  })

  const readOutput = (): Partner[] =>
    JSON.parse(readFileSync(join(outputDir, 'partners.json'), 'utf-8')) as Partner[]

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'carpets-partner-shape-'))
    queries = []
  })

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true })
  })

  it('reports null level/parent_id and empty project_ids/project_uuids for an uncurated partner with no held item', async () => {
    const db = stubDb({ partners: [partnerRow('partner-a', 0)] })
    await new PartnerExporter(context(db, null)).export()

    const output = readOutput()[0]
    expect(output?.level).toBeNull()
    expect(output?.parent_id).toBeNull()
    expect(output?.project_ids).toEqual([])
    expect(output?.project_uuids).toEqual([])
  })

  it('derives level and parent_id from the curated partner_group hierarchy', async () => {
    const db = stubDb({
      partners: [partnerRow('owner', 2), partnerRow('member', 0)],
      levels: [
        { partner_id: 'owner', level: 'partner' },
        { partner_id: 'member', level: 'associated_partner' },
      ],
      groupMemberships: [
        { collection_id: 'group-1', partner_id: 'owner', level: 'partner' },
        { collection_id: 'group-1', partner_id: 'member', level: 'associated_partner' },
      ],
    })
    await new PartnerExporter(context(db, 'project-dca-uuid')).export()

    const output = readOutput()
    const owner = output.find(p => p.id === 'owner')
    const member = output.find(p => p.id === 'member')
    expect(owner?.level).toBe('partner')
    expect(owner?.parent_id).toBeNull()
    expect(member?.level).toBe('associated_partner')
    expect(member?.parent_id).toBe('owner')
  })

  it('scopes the hierarchy query to the gallery own single project, not a list', async () => {
    const db = stubDb({ partners: [partnerRow('partner-a', 1)] })
    await new PartnerExporter(context(db, 'project-dca-uuid')).export()

    const levelQuery = queries.find(q => q.sql.includes("cp.collection_type = 'project'"))
    expect(levelQuery?.sql).toContain('proj.id = ?')
    expect(levelQuery?.sql).not.toContain('proj.id IN')
  })

  it('skips the hierarchy query entirely when the gallery has no native project', async () => {
    const db = stubDb({ partners: [partnerRow('partner-a', 1)] })
    await new PartnerExporter(context(db, null)).export()

    expect(queries.some(q => q.sql.includes("cp.collection_type = 'project'"))).toBe(false)
    expect(queries.some(q => q.sql.includes("cp.collection_type = 'collection'"))).toBe(false)
  })

  it('derives project_ids from the legacy project of each held item', async () => {
    const itemProjectKeys = new Map([
      ['item-a', 'DCA'],
      ['item-b', 'ISL'],
    ])
    const db = stubDb({
      partners: [partnerRow('partner-a', 2)],
      heldItems: [
        { partner_id: 'partner-a', item_id: 'item-a', project_id: 'project-dca-uuid' },
        { partner_id: 'partner-a', item_id: 'item-b', project_id: 'project-isl-uuid' },
      ],
    })
    await new PartnerExporter(context(db, 'project-dca-uuid', itemProjectKeys)).export()

    expect(readOutput()[0]?.project_ids?.slice().sort()).toEqual(['DCA', 'ISL'])
  })

  // Epic #1727 decision 4: project_uuids derives from the same held items as
  // project_ids, but from the item's own project_id column rather than
  // itemProjectKeys, so it never depends on the legacy-key resolution at all.
  it('derives project_uuids (raw UUIDs) from the same held items as project_ids', async () => {
    const itemProjectKeys = new Map([
      ['item-a', 'DCA'],
      ['item-b', 'ISL'],
    ])
    const db = stubDb({
      partners: [partnerRow('partner-a', 2)],
      heldItems: [
        { partner_id: 'partner-a', item_id: 'item-a', project_id: 'project-dca-uuid' },
        { partner_id: 'partner-a', item_id: 'item-b', project_id: 'project-isl-uuid' },
      ],
    })
    await new PartnerExporter(context(db, 'project-dca-uuid', itemProjectKeys)).export()

    expect(readOutput()[0]?.project_uuids?.slice().sort()).toEqual([
      'project-dca-uuid',
      'project-isl-uuid',
    ])
  })

  it('reports the gallery own project for an MWNF-384 partner holding no item', async () => {
    const db = stubDb({ partners: [partnerRow('partner-orphan', 0)] })
    await new PartnerExporter(context(db, 'project-dca-uuid')).export()

    expect(readOutput()[0]?.project_ids).toEqual(['DCA'])
    expect(readOutput()[0]?.project_uuids).toEqual(['project-dca-uuid'])
  })
})

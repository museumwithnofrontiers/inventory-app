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
 * parent_id, project_uuids, item_count, featured (decision D4,
 * museumwithnofrontiers/inventory-app#1699). This fork already had item_count/featured;
 * these cases pin the three fields it adds — level, parent_id, project_uuids —
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
    contact_fax: null,
    contact_email_general: null,
    extra: null,
  })

  const stubDb = (rows: {
    partners: unknown[]
    levels?: unknown[]
    groupMemberships?: unknown[]
    heldItems?: unknown[]
    translations?: unknown[]
    ownProjects?: unknown[]
  }): Database =>
    ({
      query: async (sql: string, params?: unknown) => {
        queries.push({ sql, params })
        if (sql.includes('AS own_project_id')) return rows.ownProjects ?? []
        if (sql.includes('FROM partners')) return rows.partners
        if (sql.includes('FROM languages')) {
          return [
            { id: 'eng', backward_compatibility: 'en' },
            { id: 'fra', backward_compatibility: 'fr' },
          ]
        }
        if (sql.includes('FROM partner_translations')) {
          return rows.translations ?? rows.partners.map(p => translationRow((p as { id: string }).id))
        }
        if (sql.includes('FROM partner_images')) return []
        if (sql.includes('FROM partner_logos')) return []
        if (sql.includes("cp.collection_type = 'project'")) return rows.levels ?? []
        if (sql.includes("cp.collection_type = 'collection'")) return rows.groupMemberships ?? []
        if (sql.includes('AS item_id')) return rows.heldItems ?? []
        return []
      },
    }) as unknown as Database

  const context = (db: Database, projectId: string | null): ExportContext => ({
    db,
    outputDir,
    siteKey: 'carpets',
    gallery: gallery(projectId),
    memberItemIds: ['item-a', 'item-b'],
    itemOwnContextIds: new Map(),
    siteCollectionIds: new Set(),
    homeSites: { byProject: new Map(), bySiteCollection: new Map(), exhibitionSites: new Map() },
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

  it('reports null level/parent_id and empty project_uuids for an uncurated partner with no held item, and no legacy project_ids key', async () => {
    const db = stubDb({ partners: [partnerRow('partner-a', 0)] })
    await new PartnerExporter(context(db, null)).export()

    const output = readOutput()[0]
    expect(output?.level).toBeNull()
    expect(output?.parent_id).toBeNull()
    expect(output?.project_uuids).toEqual([])
    expect(output).not.toHaveProperty('project_ids')
  })

  it('lists the languages each partner has a translation in, sorted', async () => {
    const db = stubDb({
      partners: [partnerRow('partner-a', 1), partnerRow('partner-b', 1)],
      translations: [{ ...translationRow('partner-a'), language_id: 'fra' }, translationRow('partner-a')],
    })
    await new PartnerExporter(context(db, null)).export()

    const output = readOutput()
    expect(output.find(p => p.id === 'partner-a')?.languages).toEqual(['en', 'fr'])
    // No translation at all: an empty list, never an absent key
    expect(output.find(p => p.id === 'partner-b')?.languages).toEqual([])
  })

  it('ships the partner fax in its translations, next to the phone', async () => {
    const db = stubDb({
      partners: [partnerRow('partner-a', 1)],
      translations: [{ ...translationRow('partner-a'), contact_phone: '+34 91 577 79 12', contact_fax: '+34 91 431 68 40' }],
    })
    await new PartnerExporter(context(db, null)).export()

    const en = JSON.parse(readFileSync(join(outputDir, 'translations', 'partners.en.json'), 'utf-8')) as Record<string, Record<string, string>>
    expect(en['partner-a']).toMatchObject({ phone: '+34 91 577 79 12', fax: '+34 91 431 68 40' })
    expect(queries.find(q => q.sql.includes('FROM partner_translations'))?.sql).toContain('contact_fax')
  })

  it('lists the contact persons in legacy order, leaving out the missing ones', async () => {
    const db = stubDb({
      partners: [partnerRow('partner-a', 1), partnerRow('partner-b', 1)],
      translations: [
        { ...translationRow('partner-a'), extra: { contact_person_1: { name: 'First' }, contact_person_2: { name: 'Second' } } },
        { ...translationRow('partner-b'), extra: { contact_person_2: { name: 'Only the second' } } },
      ],
    })
    await new PartnerExporter(context(db, null)).export()

    const output = readOutput()
    const a = output.find(p => p.id === 'partner-a')
    const b = output.find(p => p.id === 'partner-b')
    expect(a?.contact_persons).toEqual([{ name: 'First' }, { name: 'Second' }])
    expect(b?.contact_persons).toEqual([{ name: 'Only the second' }])
    // The list is the only key: contact_person_1/_2 are gone (inventory-app#2007)
    expect(b).not.toHaveProperty('contact_person_1')
    expect(b).not.toHaveProperty('contact_person_2')
  })

  it('reports an empty contact_persons list for a partner with none', async () => {
    const db = stubDb({ partners: [partnerRow('partner-a', 1)], translations: [translationRow('partner-a')] })
    await new PartnerExporter(context(db, null)).export()

    expect(readOutput()[0]?.contact_persons).toEqual([])
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

    const levelQuery = queries.find(q => q.sql.includes("cp.collection_type = 'project'") && !q.sql.includes('AS own_project_id'))
    expect(levelQuery?.sql).toContain('proj.id = ?')
    expect(levelQuery?.sql).not.toContain('proj.id IN')
  })

  it('skips the hierarchy query entirely when the gallery has no native project', async () => {
    const db = stubDb({ partners: [partnerRow('partner-a', 1)] })
    await new PartnerExporter(context(db, null)).export()

    expect(queries.some(q => q.sql.includes("cp.collection_type = 'project'") && !q.sql.includes('AS own_project_id'))).toBe(false)
    expect(queries.some(q => q.sql.includes("cp.collection_type = 'collection'"))).toBe(false)
  })

  // Epic #1727 decision 4: project_uuids derives from the held items' own
  // project_id column, so it never depends on legacy-key resolution at all.
  it('derives project_uuids (raw UUIDs) from the legacy project of each held item', async () => {
    const db = stubDb({
      partners: [partnerRow('partner-a', 2)],
      heldItems: [
        { partner_id: 'partner-a', item_id: 'item-a', project_id: 'project-dca-uuid' },
        { partner_id: 'partner-a', item_id: 'item-b', project_id: 'project-isl-uuid' },
      ],
    })
    await new PartnerExporter(context(db, 'project-dca-uuid')).export()

    expect(readOutput()[0]?.project_uuids?.slice().sort()).toEqual([
      'project-dca-uuid',
      'project-isl-uuid',
    ])
  })

  // Legacy's partner list badges each partner with its own project and its
  // tier there (dxa-api projectName / isPartner / projectSourceIsExhibition).
  it('ships each partner own project with its tier and whether it is an exhibition', async () => {
    const db = stubDb({
      partners: [partnerRow('isl', 1), partnerRow('sh', 1), partnerRow('exh', 1), partnerRow('none', 1)],
      ownProjects: [
        { partner_id: 'isl', own_project_id: 'p-isl', name: 'Discover Islamic Art', backward_compatibility: 'mwnf3:projects:ISL', level: 'partner', exhibition: 0 },
        { partner_id: 'sh', own_project_id: 'p-sh', name: 'Sharing History', backward_compatibility: 'mwnf3_sharing_history:sh_projects:awe', level: 'associated_partner', exhibition: 0 },
        { partner_id: 'exh', own_project_id: 'p-wat', name: 'Water in Islam', backward_compatibility: 'mwnf3:projects:GalEx6', level: null, exhibition: '1' },
      ],
    })
    await new PartnerExporter(context(db, null)).export()

    const output = readOutput()
    expect(output.find(p => p.id === 'isl')?.own_project).toEqual({
      id: 'p-isl', name: 'Discover Islamic Art', backward_compatibility: 'mwnf3:projects:ISL', level: 'partner', exhibition: false,
    })
    expect(output.find(p => p.id === 'sh')?.own_project).toMatchObject({ level: 'associated_partner', exhibition: false })
    expect(output.find(p => p.id === 'exh')?.own_project).toMatchObject({ level: null, exhibition: true })
    // No project: null, never an absent key
    expect(output.find(p => p.id === 'none')?.own_project).toBeNull()
  })

  it('reads the own project from partners.project_id, else the project collection listing the partner', async () => {
    const db = stubDb({ partners: [partnerRow('partner-a', 1)] })
    await new PartnerExporter(context(db, null)).export()

    const sql = queries.find(q => q.sql.includes('AS own_project_id'))?.sql ?? ''
    expect(sql).toContain('COALESCE(p.project_id')
    expect(sql).toContain("cp.collection_type = 'project'")
    // An exhibition's project is the fallback only when no other project lists
    // the partner: lending to an exhibition does not change whose partner it is.
    expect(sql).toMatch(/ORDER BY EXISTS \(SELECT 1\s+FROM collections x\s+WHERE x.type = 'exhibition'\s+AND pp.backward_compatibility/)
    expect(sql).toContain("x.type = 'exhibition'")
  })

  it('reports the gallery own project for an MWNF-384 partner holding no item', async () => {
    const db = stubDb({ partners: [partnerRow('partner-orphan', 0)] })
    await new PartnerExporter(context(db, 'project-dca-uuid')).export()

    expect(readOutput()[0]?.project_uuids).toEqual(['project-dca-uuid'])
    expect(readOutput()[0]).not.toHaveProperty('project_ids')
  })
})

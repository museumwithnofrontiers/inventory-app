import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { PartnerExporter } from '../../src/exporters/partner-exporter.js'
import type { Database } from '../../src/core/database.js'
import type { ExportContext, Partner } from '../../src/core/types.js'
import type { Logger } from '../../src/core/logger.js'

/**
 * Every dataset's partners.json carries the same five fields — level,
 * parent_id, project_uuids, item_count, featured (decision D4,
 * museumwithnofrontiers/inventory-app#1699). The standalone (project-scoped) exporters
 * already derived level/parent_id/project_uuids from the curated
 * collection_partner hierarchy; these cases pin the two fields this fork
 * adds — item_count and featured — plus their empty defaults, so a partner
 * the hierarchy or the portal flag has nothing to say about still reports a
 * value rather than an absent key.
 */
describe('PartnerExporter — shared partner shape', () => {
  let outputDir: string
  let queries: { sql: string; params: unknown }[]

  const partnerRow = (id: string, name: string) => ({
    id,
    type: 'museum',
    internal_name: name,
    backward_compatibility: `mwnf3:museums:${id}`,
    country_id: 'gbr',
    latitude: null,
    longitude: null,
    map_zoom: 16,
    monument_item_id: null,
  })

  const translationRow = (partnerId: string, extra: unknown = null) => ({
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
    extra,
  })

  const stubDb = (rows: {
    partners: unknown[]
    translations: unknown[]
    levels?: unknown[]
    groupMemberships?: unknown[]
    itemCounts?: unknown[]
  }): Database =>
    ({
      query: async (sql: string, params?: unknown) => {
        queries.push({ sql, params })
        if (sql.includes('FROM partners p')) return rows.partners
        if (sql.includes('FROM languages')) {
          return [
            { id: 'eng', backward_compatibility: 'en' },
            { id: 'fra', backward_compatibility: 'fr' },
          ]
        }
        if (sql.includes('FROM partner_translations')) return rows.translations
        if (sql.includes('FROM partner_images')) return []
        if (sql.includes('FROM partner_logos')) return []
        if (sql.includes('cp.level, proj.id AS project_id')) return rows.levels ?? []
        if (sql.includes("internal_name LIKE 'partner_group:%'")) return rows.groupMemberships ?? []
        if (sql.includes('FROM items')) return rows.itemCounts ?? []
        return []
      },
    }) as unknown as Database

  const context = (db: Database): ExportContext => ({
    db,
    outputDir,
    projectIds: ['project-isl'],
    contextIds: ['context-isl'],
    projectKeys: ['ISL'],
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
    outputDir = mkdtempSync(join(tmpdir(), 'baroqueart-partners-'))
    queries = []
  })

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true })
  })

  it('sums item_count from the same item type/project scope as items.json', async () => {
    const db = stubDb({
      partners: [partnerRow('partner-a', 'A')],
      translations: [translationRow('partner-a')],
      itemCounts: [{ partner_id: 'partner-a', item_count: 3 }],
    })
    await new PartnerExporter(context(db)).export()

    const output = readOutput()
    expect(output[0]?.item_count).toBe(3)

    const itemCountQuery = queries.find(q => q.sql.includes('FROM items'))
    expect(itemCountQuery?.sql).toContain("type IN ('object', 'monument')")
    expect(itemCountQuery?.sql).toContain('project_id IN')
  })

  it('defaults item_count to 0 for a partner holding no exported item', async () => {
    const db = stubDb({
      partners: [partnerRow('partner-a', 'A')],
      translations: [translationRow('partner-a')],
      itemCounts: [],
    })
    await new PartnerExporter(context(db)).export()

    expect(readOutput()[0]?.item_count).toBe(0)
  })

  it('reads featured from the portal_display extra flag, case-insensitively', async () => {
    const db = stubDb({
      partners: [partnerRow('partner-a', 'A'), partnerRow('partner-b', 'B')],
      translations: [
        translationRow('partner-a', { portal_display: 'Y' }),
        translationRow('partner-b', { portal_display: 'n' }),
      ],
    })
    await new PartnerExporter(context(db)).export()

    const output = readOutput()
    expect(output.find(p => p.id === 'partner-a')?.featured).toBe(true)
    expect(output.find(p => p.id === 'partner-b')?.featured).toBe(false)
  })

  it('defaults featured to false when the extra has no portal flag at all', async () => {
    const db = stubDb({
      partners: [partnerRow('partner-a', 'A')],
      translations: [translationRow('partner-a')],
    })
    await new PartnerExporter(context(db)).export()

    expect(readOutput()[0]?.featured).toBe(false)
  })

  it('still carries contact persons and extra URLs from the same extra object as portal_display', async () => {
    const db = stubDb({
      partners: [partnerRow('partner-a', 'A')],
      translations: [
        translationRow('partner-a', {
          portal_display: 'y',
          contact_person_1: { name: 'Jane Curator' },
          urls: [{ url: 'https://example.test/more' }],
        }),
      ],
    })
    await new PartnerExporter(context(db)).export()

    const output = readOutput()[0]
    expect(output?.featured).toBe(true)
    expect(output?.contact_persons).toEqual([{ name: 'Jane Curator' }])
    expect(output?.additional_urls).toEqual([{ url: 'https://example.test/more' }])
  })

  it('lists the languages each partner has a translation in, sorted', async () => {
    const db = stubDb({
      partners: [partnerRow('partner-a', 'A'), partnerRow('partner-b', 'B')],
      translations: [{ ...translationRow('partner-a'), language_id: 'fra' }, translationRow('partner-a')],
    })
    await new PartnerExporter(context(db)).export()

    const output = readOutput()
    expect(output.find(p => p.id === 'partner-a')?.languages).toEqual(['en', 'fr'])
    // No translation at all: an empty list, never an absent key
    expect(output.find(p => p.id === 'partner-b')?.languages).toEqual([])
  })

  it('ships the partner fax in its translations, next to the phone', async () => {
    const db = stubDb({
      partners: [partnerRow('partner-a', 'A')],
      translations: [{ ...translationRow('partner-a'), contact_phone: '+34 91 577 79 12', contact_fax: '+34 91 431 68 40' }],
    })
    await new PartnerExporter(context(db)).export()

    const en = JSON.parse(readFileSync(join(outputDir, 'translations', 'partners.en.json'), 'utf-8')) as Record<string, Record<string, string>>
    expect(en['partner-a']).toMatchObject({ phone: '+34 91 577 79 12', fax: '+34 91 431 68 40' })
    expect(queries.find(q => q.sql.includes('FROM partner_translations'))?.sql).toContain('contact_fax')
  })

  it('lists the contact persons in legacy order, leaving out the missing ones', async () => {
    const db = stubDb({
      partners: [partnerRow('partner-a', 'A'), partnerRow('partner-b', 'B')],
      translations: [
        { ...translationRow('partner-a'), extra: { contact_person_1: { name: 'First' }, contact_person_2: { name: 'Second' } } },
        { ...translationRow('partner-b'), extra: { contact_person_2: { name: 'Only the second' } } },
      ],
    })
    await new PartnerExporter(context(db)).export()

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
    const db = stubDb({ partners: [partnerRow('partner-a', 'A')], translations: [translationRow('partner-a')] })
    await new PartnerExporter(context(db)).export()

    expect(readOutput()[0]?.contact_persons).toEqual([])
  })
  it('reports null level/parent_id and an empty project_uuids for an uncurated partner, and no legacy project_ids key', async () => {
    const db = stubDb({
      partners: [partnerRow('partner-a', 'A')],
      translations: [translationRow('partner-a')],
    })
    await new PartnerExporter(context(db)).export()

    const output = readOutput()[0]
    expect(output?.level).toBeNull()
    expect(output?.parent_id).toBeNull()
    expect(output?.project_uuids).toEqual([])
    expect(output).not.toHaveProperty('project_ids')
  })

  it('derives level and parent_id from the curated hierarchy', async () => {
    const db = stubDb({
      partners: [partnerRow('owner', 'Owner museum'), partnerRow('member', 'Member museum')],
      translations: [translationRow('owner'), translationRow('member')],
      levels: [
        { partner_id: 'owner', level: 'partner', project_id: 'project-isl' },
        { partner_id: 'member', level: 'associated_partner', project_id: 'project-isl' },
      ],
      groupMemberships: [
        { collection_id: 'group-1', partner_id: 'owner', level: 'partner' },
        { collection_id: 'group-1', partner_id: 'member', level: 'associated_partner' },
      ],
    })
    await new PartnerExporter(context(db)).export()

    const output = readOutput()
    const owner = output.find(p => p.id === 'owner')
    const member = output.find(p => p.id === 'member')
    expect(owner?.level).toBe('partner')
    expect(owner?.parent_id).toBeNull()
    expect(member?.level).toBe('associated_partner')
    expect(member?.parent_id).toBe('owner')
  })

  // Epic #1727 decision 4: project_uuids ships the raw project UUIDs this
  // partner is curated under. The legacy-key project_ids field it originally
  // shipped alongside (so old and new consumers could never silently misread
  // the array) is gone as of the cleanup wave.
  it('derives project_uuids (raw UUIDs) from the curated hierarchy', async () => {
    const db = stubDb({
      partners: [partnerRow('owner', 'Owner museum')],
      translations: [translationRow('owner')],
      levels: [{ partner_id: 'owner', level: 'partner', project_id: 'project-isl' }],
    })
    await new PartnerExporter(context(db)).export()

    const owner = readOutput().find(p => p.id === 'owner')
    expect(owner?.project_uuids).toEqual(['project-isl'])
    expect(owner).not.toHaveProperty('project_ids')
  })
})

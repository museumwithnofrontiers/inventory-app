import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { PartnerExporter, groupParents } from '../../src/exporters/partner-exporter.js'
import { LANGUAGES, context, fakeDb, tempDir, type Route } from './support.js'

describe('PartnerExporter', () => {
  let out: ReturnType<typeof tempDir>
  beforeEach(() => {
    out = tempDir()
  })
  afterEach(() => out.cleanup())

  const partnerRow = (id: string, country: string) => ({
    id,
    type: 'museum',
    internal_name: id,
    backward_compatibility: `mwnf3:museums:${id}:${country}`,
    country_id: country,
    latitude: '47.3',
    longitude: null,
    map_zoom: null,
    monument_item_id: null,
  })

  const routes = (overrides: Route[] = []): Route[] => [
    ...overrides,
    LANGUAGES,
    [/FROM partners WHERE project_id = \?/, () => [{ id: 'swiss' }, { id: 'caramulo' }]],
    [/FROM partners\s+WHERE id IN/, () => [partnerRow('caramulo', 'prt'), partnerRow('swiss', 'che')]],
    [
      /FROM partner_translations/,
      () => [
        {
          partner_id: 'swiss',
          language_id: 'eng',
          name: 'Swiss National Museum',
          description: 'A museum',
          city_display: 'Zurich',
          address_notes: null,
          contact_website: null,
          contact_phone: null,
          contact_fax: null,
          contact_email_general: null,
          extra: { portal_display: 'n', contact_person_1: { name: 'A' } },
        },
        {
          partner_id: 'swiss',
          language_id: 'fra',
          name: 'Musée national suisse',
          description: null,
          city_display: 'Zurich',
          address_notes: null,
          contact_website: null,
          contact_phone: null,
          contact_fax: null,
          contact_email_general: null,
          extra: null,
        },
        {
          partner_id: 'caramulo',
          language_id: 'eng',
          name: 'Museu do Caramulo',
          description: null,
          city_display: 'Caramulo',
          address_notes: null,
          contact_website: null,
          contact_phone: null,
          contact_fax: null,
          contact_email_general: null,
          extra: null,
        },
      ],
    ],
    [/FROM partner_images/, () => []],
    [/FROM partner_logos/, () => [{ partner_id: 'swiss', path: 'logo.jpg', logo_type: 'primary', alt_text: null, display_order: 1 }]],
    // Legacy's "Partner" tier; Museu do Caramulo has no level — legacy's "Affiliate".
    [/cp\.collection_type = 'project'/, () => [{ partner_id: 'swiss', level: 'partner' }]],
    [/cp\.collection_type = 'collection'/, () => []],
  ]

  it("ships the partner project's museums in the shared partner shape, with no item behind them", async () => {
    const db = fakeDb(routes())
    const result = await new PartnerExporter(context(db, out.dir)).export()

    expect(result).toEqual({ file: 'partners.json', count: 2 })
    const partners = out.read('partners.json') as Record<string, unknown>[]
    expect(partners.map(p => p['id'])).toEqual(['caramulo', 'swiss'])

    const swiss = partners[1]!
    expect(swiss).toMatchObject({
      level: 'partner',
      parent_id: null,
      project_uuids: ['galleries-project-uuid'],
      item_count: 0,
      featured: false,
      languages: ['en', 'fr'],
      contact_persons: [{ name: 'A' }],
      logos: [{ url: 'https://example.test/pub/logo.jpg', logo_type: 'primary', alt_text: null, display_order: 1 }],
      latitude: 47.3,
      longitude: null,
    })
    expect(partners[0]).toMatchObject({ level: null, item_count: 0, languages: ['en'] })
  })

  it('writes one translation file per language, without the empty fields', async () => {
    const db = fakeDb(routes())
    await new PartnerExporter(context(db, out.dir)).export()

    expect(out.read('translations/partners.fr.json')).toEqual({
      swiss: { name: 'Musée national suisse', city: 'Zurich' },
    })
    expect(Object.keys(out.read('translations/partners.en.json') as object).sort()).toEqual(['caramulo', 'swiss'])
  })

  it('reads the curated level in the partner project only', async () => {
    const db = fakeDb(routes())
    await new PartnerExporter(context(db, out.dir)).export()

    const levels = db.calls.find(call => /cp\.collection_type = 'project'/.test(call.sql))
    expect(levels?.params[0]).toBe('galleries-project-uuid')
  })

  it('fails loudly when the partner project has no museum', async () => {
    const db = fakeDb(routes([[/FROM partners WHERE project_id = \?/, () => []]]))
    await expect(new PartnerExporter(context(db, out.dir)).export()).rejects.toThrow(/no museum/)
  })
})

describe('groupParents', () => {
  it("maps a group member to the group's owner, and never an owner to itself", () => {
    const parents = groupParents([
      { collection_id: 'g1', partner_id: 'owner', level: 'partner' },
      { collection_id: 'g1', partner_id: 'member', level: 'associated_partner' },
      { collection_id: 'g2', partner_id: 'owner', level: 'minor_contributor' },
    ])
    expect([...parents.entries()]).toEqual([['member', 'owner']])
  })
})

import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  DEMO_ORIGIN,
  INSTANCES_DIR,
  loadSites,
  readItemFacts,
  resolveItemSites,
  siteLink,
  siteOf,
  sitesShowing,
  type CollectionFacts,
  type ItemFacts,
  type Site,
} from '../../../shared/sites.mjs'

/**
 * The shared rule for which sites show an item (D1, #2535), read by the
 * Publications and Travels references and, later, the search exporter.
 */
describe('loadSites over the instance files', () => {
  const sites = loadSites()
  const bySlug = new Map(sites.map(s => [s.slug, s]))
  const instance = (slug: string) =>
    JSON.parse(readFileSync(join(INSTANCES_DIR, `${slug}.json`), 'utf-8')) as Record<string, unknown>

  it('has one site per instance file', () => {
    const files = readdirSync(INSTANCES_DIR).filter(f => f.endsWith('.json'))
    expect(sites).toHaveLength(files.length)
    expect(new Set(sites.map(s => s.slug)).size).toBe(sites.length)
  })

  it('serves every site at its GitHub Pages address until its own domain is set', () => {
    for (const site of sites) {
      const declared = instance(site.slug)['origin']
      expect(site.origin).toBe(declared ?? `${DEMO_ORIGIN}/${site.slug}`)
    }
    expect(bySlug.get('publications')!.origin).toBe('https://museumwithnofrontiers.github.io/publications')
    expect(bySlug.get('travels')!.origin).toBe('https://museumwithnofrontiers.github.io/travels')
  })

  it('reads each kind of membership', () => {
    expect(bySlug.get('islamicart')!.rule).toEqual({ type: 'project', projectIds: instance('islamicart')['project_ids'] })
    expect(bySlug.get('carpets')!.rule).toEqual({ type: 'collection', collectionId: instance('carpets')['collection_id'] })
    expect(bySlug.get('the-hijaz-railway')!.rule?.type).toBe('collection')
    expect(bySlug.get('islamicart-the-mamluks')!.rule).toEqual({
      type: 'subtree',
      collectionId: instance('islamicart-the-mamluks')['collection_id'],
    })
    expect(bySlug.get('explore')!.rule).toEqual({ type: 'tree', rootPurpose: 'explore-root', memberOf: null })
    expect(bySlug.get('travels')!.rule).toEqual({ type: 'tree', rootPurpose: 'travels-root', memberOf: ['location'] })
    expect(bySlug.get('galleries')!.rule).toBeNull()
    expect(bySlug.get('publications')!.rule).toBeNull()
  })

  it("routes an item to Explore's monument page and everywhere else to /item", () => {
    expect(bySlug.get('explore')!.itemPath).toBe('/monument/:id')
    expect(bySlug.get('islamicart')!.itemPath).toBe('/item/:id')
    expect(bySlug.get('travels')!.itemPath).toBe('/item/:id')
  })

  it('gives every project one home', () => {
    const homes = sites.flatMap(s => (s.rule?.type === 'project' ? s.rule.projectIds : []))
    expect(new Set(homes).size).toBe(homes.length)
  })
})

describe('loadSites refuses a broken instance file', () => {
  let dir = ''
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
    dir = ''
  })
  const write = (data: unknown) => {
    dir = mkdtempSync(join(tmpdir(), 'sites-'))
    writeFileSync(join(dir, 'x.json'), JSON.stringify(data))
    return dir
  }

  it('with two membership rules', () => {
    expect(() =>
      loadSites(write({ kind: 'standalone', slug: 'x', project_ids: [], item_scope: { root_purpose: 'r' } }))
    ).toThrow(/two rules/)
  })

  it('with an origin ending in a slash', () => {
    expect(() => loadSites(write({ kind: 'standalone', slug: 'x', origin: 'https://x.test/' }))).toThrow(/origin/)
  })

  it('with a collection site and no collection', () => {
    expect(() => loadSites(write({ kind: 'gallery', slug: 'x' }))).toThrow(/collection_id/)
  })

  it('with an unknown kind', () => {
    expect(() => loadSites(write({ kind: 'portal', slug: 'x' }))).toThrow(/kind/)
  })
})

describe('sitesShowing', () => {
  const site = (slug: string, rule: Site['rule'], itemPath = '/item/:id'): Site => ({
    slug,
    kind: 'x',
    origin: `https://example.test/${slug}`,
    itemPath,
    rule,
  })
  const sites: Site[] = [
    site('carpets', { type: 'collection', collectionId: 'gallery' }),
    site('explore', { type: 'tree', rootPurpose: 'explore-root', memberOf: null }, '/monument/:id'),
    site('galleries', null),
    site('islamicart', { type: 'project', projectIds: ['isl'] }),
    site('islamicart-water', { type: 'subtree', collectionId: 'exhibition' }),
    site('travels', { type: 'tree', rootPurpose: 'travels-root', memberOf: ['location'] }),
  ]
  const collections = new Map<string, CollectionFacts>(
    [
      { id: 'gallery', parent_id: null, type: 'gallery', purpose: null },
      { id: 'exhibition', parent_id: null, type: 'exhibition', purpose: null },
      { id: 'theme', parent_id: 'exhibition', type: 'theme', purpose: null },
      { id: 'travels', parent_id: null, type: 'collection', purpose: 'travels-root' },
      { id: 'trail', parent_id: 'travels', type: 'exhibition trail', purpose: null },
      { id: 'itinerary', parent_id: 'trail', type: 'itinerary', purpose: null },
      { id: 'location', parent_id: 'itinerary', type: 'location', purpose: null },
      { id: 'explore', parent_id: null, type: 'collection', purpose: 'explore-root' },
      { id: 'explore-location', parent_id: 'explore', type: 'location', purpose: null },
    ].map(c => [c.id, c])
  )
  const item = (overrides: Partial<ItemFacts>): ItemFacts => ({
    id: 'i1',
    type: 'object',
    project_id: null,
    memberships: [],
    ...overrides,
  })
  const slugs = (facts: ItemFacts) => sitesShowing(facts, sites, collections).map(s => s.site)

  it('lists the home site first, then the others in file order', () => {
    const facts = item({
      project_id: 'isl',
      memberships: [
        { collection_id: 'gallery', viaPicture: false },
        { collection_id: 'theme', viaPicture: true },
      ],
    })
    expect(slugs(facts)).toEqual(['islamicart', 'carpets', 'islamicart-water'])
    expect(sitesShowing(facts, sites, collections)[0]).toEqual({
      site: 'islamicart',
      path: '/item/i1',
      url: 'https://example.test/islamicart/#/item/i1',
    })
  })

  it("counts a gallery's own members only, never a picture placed there", () => {
    expect(slugs(item({ memberships: [{ collection_id: 'gallery', viaPicture: true }] }))).toEqual([])
  })

  it("shows a Travels monument on Travels, a trail's own entry not", () => {
    expect(slugs(item({ type: 'monument', memberships: [{ collection_id: 'location', viaPicture: false }] }))).toEqual([
      'travels',
    ])
    expect(
      slugs(item({ project_id: 'isl', memberships: [{ collection_id: 'trail', viaPicture: false }] }))
    ).toEqual(['islamicart'])
  })

  it("links Explore's monuments to its monument page", () => {
    const links = sitesShowing(
      item({ type: 'monument', memberships: [{ collection_id: 'explore-location', viaPicture: false }] }),
      sites,
      collections
    )
    expect(links).toEqual([{ site: 'explore', path: '/monument/i1', url: 'https://example.test/explore/#/monument/i1' }])
  })

  it('shows a picture on no project site', () => {
    expect(slugs(item({ type: 'picture', project_id: 'isl' }))).toEqual([])
  })
})

describe('siteLink and siteOf', () => {
  const sites = loadSites()
  it('builds the address viewer-core builds', () => {
    expect(siteLink(siteOf('publications', sites), '/publication/:id', 'p1')).toEqual({
      site: 'publications',
      path: '/publication/p1',
      url: 'https://museumwithnofrontiers.github.io/publications/#/publication/p1',
    })
  })
  it('refuses an unknown slug', () => {
    expect(() => siteOf('books', sites)).toThrow(/books/)
  })
})

describe('readItemFacts and resolveItemSites', () => {
  // A trail entry of Islamic Art (object o1, also a picture of it in a
  // location) and an unknown id.
  const query = async (sql: string, params: (string | number | null)[] = []) => {
    if (sql.includes('FROM items WHERE id IN')) return [{ id: 'o1', type: 'object', project_id: 'isl' }]
    if (sql.includes('FROM collection_item')) {
      return [
        { item_id: 'o1', collection_id: 'trail', via_picture: 0 },
        { item_id: 'o1', collection_id: 'location', via_picture: 1 },
      ]
    }
    if (sql.includes('FROM collections')) {
      const all: Record<string, CollectionFacts> = {
        trail: { id: 'trail', parent_id: 'travels', type: 'exhibition trail', purpose: null },
        location: { id: 'location', parent_id: 'trail', type: 'location', purpose: null },
        travels: { id: 'travels', parent_id: null, type: 'collection', purpose: 'travels-root' },
      }
      return params.map(id => all[id as string]).filter(Boolean)
    }
    return []
  }
  const sites: Site[] = [
    { slug: 'islamicart', kind: 'standalone', origin: 'https://x.test/islamicart', itemPath: '/item/:id', rule: { type: 'project', projectIds: ['isl'] } },
    { slug: 'travels', kind: 'standalone', origin: 'https://x.test/travels', itemPath: '/item/:id', rule: { type: 'tree', rootPurpose: 'travels-root', memberOf: ['location'] } },
  ]

  it('walks each membership up to its root', async () => {
    const { items, collections } = await readItemFacts(query, ['o1'])
    expect(items.get('o1')!.memberships).toEqual([
      { collection_id: 'trail', viaPicture: false },
      { collection_id: 'location', viaPicture: true },
    ])
    expect([...collections.keys()].sort()).toEqual(['location', 'trail', 'travels'])
  })

  it('maps an unknown id to no site', async () => {
    const result = await resolveItemSites(query, ['o1', 'gone'], sites)
    expect(result.get('o1')!.map(s => s.site)).toEqual(['islamicart'])
    expect(result.get('gone')).toEqual([])
  })
})

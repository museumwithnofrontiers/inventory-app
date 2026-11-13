import { describe, expect, it } from 'vitest'

import { exploreMonuments, resolveItemPages, sourceRank } from '../../../shared/pages.mjs'
import type { Site, SiteLink } from '../../../shared/sites.mjs'

const LOC = 'a743b6f7-ecc4-5665-83e5-867604ed31a4'
const ISL_A = '039d2f5d-461a-5a1d-8e3f-0de426d00dc5'
const TRAVELS = '289ef8ef-f6b2-5883-932e-dfca0da0b55d'
const ISL_B = 'd5c5f093-ca34-5969-a805-e9d059622bea'

// Explore monument 529 in Saragossa (staging, 2026-11-13): an Islamic Art record
// listed first, the Travels record, and the Mudéjar part of the Aljafería.
const members = [
  { location: LOC, item: ISL_B, order: null, key: 'mwnf3:monuments:ISL:es:Mon01:20', extra: { explore_monument_ids: [529] } },
  { location: LOC, item: ISL_A, order: null, key: 'mwnf3:monuments:ISL:es:Mon01:4', extra: '{"explore_monument_ids":[529]}' },
  { location: LOC, item: TRAVELS, order: null, key: 'mwnf3_travels:monument:IAM:es:1:III:1:a', extra: { explore_monument_ids: [529] } },
  { location: LOC, item: 'other', order: 1, key: 'mwnf3_explore:x', extra: { explore_monument_ids: [600] } },
]

describe('exploreMonuments, as Explore groups a location', () => {
  it('opens every record of a monument on its best-ranked one', () => {
    const pages = exploreMonuments(members)
    for (const id of [ISL_A, ISL_B, TRAVELS]) expect(pages.get(id)).toEqual([{ location: LOC, main: TRAVELS }])
    expect(pages.get('other')).toEqual([{ location: LOC, main: 'other' }])
  })

  it('keeps the membership order among records of one source', () => {
    const pages = exploreMonuments(members.filter(m => m.item !== TRAVELS))
    expect(pages.get(ISL_B)).toEqual([{ location: LOC, main: ISL_A }])
  })

  it('ranks the sources as Explore does', () => {
    expect(['mwnf3_travels:x', 'mwnf3:x', 'mwnf3_sharing_history:x', 'mwnf3_explore:x', null].map(sourceRank)).toEqual([0, 1, 2, 3, 4])
  })
})

describe('resolveItemPages', () => {
  const site = (slug: string, rule: Site['rule']): Site => ({
    slug, kind: 'standalone', name: slug, parent: null, origin: `https://x.test/${slug}`,
    itemPath: slug === 'explore' ? '/monument/:id' : '/item/:id', rule,
  })
  const sites = [
    site('islamicart', { type: 'project', projectIds: ['p'] }),
    site('explore', { type: 'tree', rootPurpose: 'explore-root', memberOf: null }),
    site('travels', { type: 'tree', rootPurpose: 'travels-root', memberOf: ['location'] }),
  ]
  const link = (slug: string, id: string): SiteLink => {
    const path = (slug === 'explore' ? '/monument/:id' : '/item/:id').replace(':id', id)
    return { site: slug, path, url: `https://x.test/${slug}/#${path}` }
  }
  const collections = [
    { id: 'root-e', parent_id: null, type: 'collection', purpose: 'explore-root' },
    { id: 'region', parent_id: 'root-e', type: 'region', purpose: null },
    { id: LOC, parent_id: 'region', type: 'location', purpose: null },
    { id: 'root-t', parent_id: null, type: 'collection', purpose: 'travels-root' },
    { id: 'trail', parent_id: 'root-t', type: 'exhibition trail', purpose: null },
    { id: 'itin', parent_id: 'trail', type: 'itinerary', purpose: null },
    { id: 'tloc', parent_id: 'itin', type: 'location', purpose: null },
  ]
  const query = async (sql: string, params: (string | number | null)[] = []) => {
    if (sql.startsWith('SELECT id, parent_id, type, purpose FROM collections')) return collections
    if (sql.includes('SELECT DISTINCT ci.collection_id')) return params.includes(ISL_B) || params.includes(TRAVELS) ? [{ collection_id: LOC }] : []
    if (sql.includes('i.backward_compatibility, ci.extra')) {
      return members.map(m => ({ collection_id: m.location, item_id: m.item, display_order: m.order, backward_compatibility: m.key, extra: m.extra }))
    }
    if (sql.includes('SELECT ci.item_id, ci.collection_id')) return params.includes(TRAVELS) ? [{ item_id: TRAVELS, collection_id: 'tloc' }] : []
    throw new Error(`unexpected query ${sql}`)
  }

  it("sends Explore to the monument's main record, Travels to the itinerary's gallery, and keeps the others", async () => {
    const links = new Map([
      [ISL_B, [link('islamicart', ISL_B), link('explore', ISL_B)]],
      [TRAVELS, [link('explore', TRAVELS), link('travels', TRAVELS)]],
    ])
    const pages = await resolveItemPages(query, links, sites, new Map())
    expect(pages.get(ISL_B)?.map(l => l.path)).toEqual([`/item/${ISL_B}`, `/monument/${TRAVELS}?location=${LOC}`])
    expect(pages.get(TRAVELS)?.map(l => l.path)).toEqual([`/monument/${TRAVELS}?location=${LOC}`, '/itinerary/itin?tab=vl'])
    expect(pages.get(TRAVELS)?.[1].url).toBe('https://x.test/travels/#/itinerary/itin?tab=vl')
  })

  it('drops a mini-site link: its items show on its exhibition pages, not on item pages', async () => {
    const withMini = [...sites, { ...site('islamicart-mudejar-art', { type: 'subtree', collectionId: 'c' }), kind: 'minisite' }]
    const links = new Map([[ISL_B, [link('islamicart', ISL_B), link('islamicart-mudejar-art', ISL_B)]]])
    const pages = await resolveItemPages(query, links, withMini, new Map())
    expect(pages.get(ISL_B)?.map(l => l.site)).toEqual(['islamicart'])
  })

  it('opens a detail on its monument, and drops a link no page opens', async () => {
    const links = new Map([
      ['detail-1', [link('explore', 'detail-1')]],
      ['nowhere', [link('explore', 'nowhere'), link('travels', 'nowhere')]],
    ])
    const pages = await resolveItemPages(query, links, sites, new Map([['detail-1', ISL_B], ['nowhere', null]]))
    expect(pages.get('detail-1')?.map(l => l.path)).toEqual([`/monument/${TRAVELS}?location=${LOC}`])
    expect(pages.get('nowhere')).toEqual([])
  })
})

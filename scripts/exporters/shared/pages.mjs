// @ts-check
/**
 * Which page of a site opens an item (M15, the global search).
 *
 * `sites.mjs` says which sites SHOW an item, on purpose coarsely. Most sites
 * have a page per item at their `itemPath`, but two do not:
 *
 * - **Explore** has a page per monument of a location, not per record: a
 *   location's records are grouped by `explore_monument_ids` (on their
 *   membership), and the group opens on its main record, the one from the
 *   best-ranked source (Travels, then a Virtual Museum, Sharing History,
 *   Explore's own), records of one source in membership order. Any other
 *   record of the group is shown there as related content. The page is
 *   `/monument/<main>?location=<location>`, as Explore's `findMonument()`
 *   reads it. A detail opens on its monument's page.
 * - **Travels** has no item page at all: a monument of an itinerary's
 *   location shows in that itinerary's image gallery,
 *   `/itinerary/<itinerary>?tab=vl`.
 * - **A mini-site** (kind `minisite`) has no item page either: its items show
 *   on its exhibition pages (`/exhibition/<theme>/<page>` for Islamic Art's;
 *   Baroque Art's and Sharing History's have pages of their own), numbered by
 *   legacy's layout. Its link is dropped. Every item a mini-site shows is also
 *   its product's, whose item page opens it.
 *
 * `resolveItemPages()` turns each SiteLink into the page that opens it, and
 * drops a link no page opens, so a link never leads to "This page does not
 * exist". The rules mirror Explore's `monumentsOf()`/`sourceOf()`
 * (museumwithnofrontiers/explore `src/composables/explore.js`) and the
 * Travels itinerary page (viewer-layout `src/travels/Itinerary.vue`): change
 * them together.
 *
 * Types are in `pages.d.mts`.
 */

import { siteLink } from './sites.mjs'

/** Explore's source order, by legacy key prefix (explore `sourceOf`). */
export const EXPLORE_SOURCES = ['mwnf3_travels:', 'mwnf3:', 'mwnf3_sharing_history:', 'mwnf3_explore:']

/** @param {string | null} key */
export function sourceRank(key) {
  const rank = EXPLORE_SOURCES.findIndex(prefix => (key ?? '').startsWith(prefix))
  return rank === -1 ? EXPLORE_SOURCES.length : rank
}

const CHUNK = 500
/** @param {unknown[]} values */
const marks = values => values.map(() => '?').join(', ')
/**
 * @template T
 * @param {T[]} values
 */
function chunks(values) {
  /** @type {T[][]} */
  const out = []
  for (let i = 0; i < values.length; i += CHUNK) out.push(values.slice(i, i + CHUNK))
  return out
}

/** @param {unknown} extra */
function monumentIds(extra) {
  let value = extra
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return []
    }
  }
  const ids = /** @type {Record<string, unknown> | null} */ (value)?.['explore_monument_ids']
  return Array.isArray(ids) ? ids.map(String) : []
}

/**
 * Explore's monuments of some locations: for every record, the
 * `{ location, main }` pairs it belongs to, in location order.
 *
 * @param {{ location: string, item: string, order: number | null, key: string | null, extra: unknown }[]} members
 *   every membership of those locations, in any order
 * @returns {Map<string, { location: string, main: string }[]>}
 */
export function exploreMonuments(members) {
  const sorted = [...members].sort(
    (a, b) =>
      (a.location < b.location ? -1 : a.location > b.location ? 1 : 0) ||
      (a.order === null ? 1 : 0) - (b.order === null ? 1 : 0) ||
      (a.order ?? 0) - (b.order ?? 0) ||
      (a.item < b.item ? -1 : a.item > b.item ? 1 : 0)
  )
  /** @type {Map<string, { location: string, records: { item: string, key: string | null }[] }>} */
  const groups = new Map()
  for (const m of sorted) {
    for (const id of monumentIds(m.extra)) {
      const key = `${m.location}\u0000${id}`
      const group = groups.get(key) ?? { location: m.location, records: [] }
      group.records.push({ item: m.item, key: m.key })
      groups.set(key, group)
    }
  }
  /** @type {Map<string, { location: string, main: string }[]>} */
  const out = new Map()
  for (const group of groups.values()) {
    // A stable sort, as Explore's: records of one source keep the membership's order.
    const [main] = [...group.records].sort((a, b) => sourceRank(a.key) - sourceRank(b.key))
    for (const record of group.records) {
      const list = out.get(record.item) ?? []
      if (!list.some(p => p.location === group.location && p.main === main.item)) list.push({ location: group.location, main: main.item })
      out.set(record.item, list)
    }
  }
  return out
}

/**
 * The page that opens each item on each site that shows it.
 *
 * @param {import('./sites.d.mts').Query} query
 * @param {Map<string, import('./sites.d.mts').SiteLink[]>} links what `resolveItemSites()` returned
 * @param {import('./sites.d.mts').Site[]} sites
 * @param {Map<string, string | null>} parents item id → its parent item (a detail's monument)
 * @returns {Promise<Map<string, import('./sites.d.mts').SiteLink[]>>}
 */
export async function resolveItemPages(query, links, sites, parents) {
  const explore = sites.find(s => s.rule?.type === 'tree' && s.rule.rootPurpose === 'explore-root') ?? null
  const travels = sites.find(s => s.rule?.type === 'tree' && s.rule.rootPurpose === 'travels-root') ?? null

  /** @param {import('./sites.d.mts').Site | null} site */
  const holders = site => (site ? [...links].filter(([, l]) => l.some(x => x.site === site.slug)).map(([id]) => id) : [])
  const exploreIds = holders(explore)
  const travelsIds = holders(travels)

  // Every collection's type and parent, to know the locations and their itineraries.
  const collections = new Map(
    /** @type {{ id: string, parent_id: string | null, type: string, purpose: string | null }[]} */ (
      await query('SELECT id, parent_id, type, purpose FROM collections ORDER BY id')
    ).map(c => [c.id, c])
  )
  /** @param {string} id @param {string} purpose */
  const under = (id, purpose) => {
    const seen = new Set()
    for (let c = collections.get(id); c && !seen.has(c.id); c = c.parent_id ? collections.get(c.parent_id) : undefined) {
      if (c.purpose === purpose) return true
      seen.add(c.id)
    }
    return false
  }

  /** @type {Map<string, { location: string, main: string }[]>} */
  let monuments = new Map()
  if (explore && exploreIds.length) {
    // The records and their monuments' parents (a detail opens on its monument).
    const wanted = [...new Set([...exploreIds, ...exploreIds.map(id => parents.get(id)).filter(p => typeof p === 'string')])]
    const locations = new Set()
    for (const part of chunks(wanted)) {
      const rows = /** @type {{ collection_id: string }[]} */ (
        await query(`SELECT DISTINCT ci.collection_id FROM collection_item ci JOIN collections c ON c.id = ci.collection_id
                     WHERE c.type = 'location' AND ci.item_id IN (${marks(part)}) ORDER BY ci.collection_id`, part)
      )
      for (const r of rows) if (under(r.collection_id, 'explore-root')) locations.add(r.collection_id)
    }
    /** @type {{ location: string, item: string, order: number | null, key: string | null, extra: unknown }[]} */
    const members = []
    for (const part of chunks([...locations].sort())) {
      const rows = /** @type {{ collection_id: string, item_id: string, display_order: number | null, backward_compatibility: string | null, extra: unknown }[]} */ (
        await query(
          `SELECT ci.collection_id, ci.item_id, ci.display_order, i.backward_compatibility, ci.extra
           FROM collection_item ci JOIN items i ON i.id = ci.item_id
           WHERE ci.collection_id IN (${marks(part)}) ORDER BY ci.collection_id, ci.item_id`,
          part
        )
      )
      for (const r of rows) members.push({ location: r.collection_id, item: r.item_id, order: r.display_order, key: r.backward_compatibility, extra: r.extra })
    }
    monuments = exploreMonuments(members)
  }

  /** @type {Map<string, string[]>} */
  const itineraries = new Map()
  if (travels && travelsIds.length) {
    for (const part of chunks(travelsIds)) {
      const rows = /** @type {{ item_id: string, collection_id: string }[]} */ (
        await query(`SELECT ci.item_id, ci.collection_id FROM collection_item ci JOIN collections c ON c.id = ci.collection_id
                     WHERE c.type = 'location' AND ci.item_id IN (${marks(part)}) ORDER BY ci.item_id, ci.collection_id`, part)
      )
      for (const r of rows) {
        const parent = collections.get(r.collection_id)?.parent_id
        if (!parent || collections.get(parent)?.type !== 'itinerary' || !under(parent, 'travels-root')) continue
        const list = itineraries.get(r.item_id) ?? []
        if (!list.includes(parent)) list.push(parent)
        itineraries.set(r.item_id, list)
      }
    }
  }

  const minisites = new Set(sites.filter(s => s.kind === 'minisite').map(s => s.slug))

  /** @type {Map<string, import('./sites.d.mts').SiteLink[]>} */
  const out = new Map()
  for (const [id, list] of links) {
    /** @type {import('./sites.d.mts').SiteLink[]} */
    const pages = []
    for (const link of list) {
      if (minisites.has(link.site)) continue
      if (explore && link.site === explore.slug) {
        const own = monuments.get(id) ?? []
        const parent = parents.get(id)
        const page = own[0] ?? (parent ? (monuments.get(parent) ?? [])[0] : undefined)
        if (page) {
          const route = `/monument/${page.main}?location=${page.location}`
          pages.push({ site: link.site, path: route, url: `${explore.origin}/#${route}` })
        }
        continue
      }
      if (travels && link.site === travels.slug) {
        const itinerary = (itineraries.get(id) ?? [])[0]
        if (itinerary) pages.push(siteLink(travels, '/itinerary/:id?tab=vl', itinerary))
        continue
      }
      pages.push(link)
    }
    out.set(id, pages)
  }
  return out
}

// @ts-check
/**
 * Which sites show an item (M14 D1, inventory-app#2535).
 *
 * One rule, read by every exporter that points at another site's item page
 * rather than copying the item: the Publications and Travels references
 * today, the search exporter of the My app later. Written once so that two
 * exporters cannot disagree on where an item lives.
 *
 * The sites are the instance files (`scripts/exporters/instances/*.json`).
 * Each kind of instance says which items its site shows:
 *
 * - `standalone` with `project_ids` (Islamic Art, Baroque Art, Sharing
 *   History): the objects and monuments of those projects. The site is the
 *   items' home, so it comes first in an item's list.
 * - `standalone` with `item_scope` (Explore, Travels): the objects, monuments
 *   and details that are members of a collection under the collection of
 *   purpose `item_scope.root_purpose`; `item_scope.member_of`, when present,
 *   narrows that to members of collections of those types (a Travels trail's
 *   own entries are Islamic Art's records, not the Travels site's).
 * - `gallery` and `exhibition`: the objects and monuments that are members of
 *   the collection (the membership union the importer materialises).
 * - `minisite`: the items its collection and the collections below it place;
 *   a placement of a picture counts as the picture's item.
 * - any other `standalone` (the galleries hub, Publications): no item.
 * - `search` (the global search site, M15): no item. It is the site that
 *   links to the others, never one an item lives on.
 *
 * Explore shows fewer collections than its tree holds (its exporter's
 * `isShown`), so the tree rule can name Explore for an item of a collection
 * Explore hides. The rule stays coarse on purpose: copying that exporter's
 * rules here would be the drift this module exists to prevent.
 *
 * A site's address is `origin` from its instance file, or its demo address
 * on GitHub Pages (`https://museumwithnofrontiers.github.io/<slug>`), which is
 * where every site is served until its own domain cutover. A page is
 * `<origin>/#<path>`, as viewer-core's `siblingSiteUrl` writes it, so a
 * website can also rebuild the address from `site` and `path` alone.
 *
 * Plain JavaScript with no dependency, like `instances/plan.mjs`, so that
 * every exporter (and a bare `node`) can import it; its types are in
 * `sites.d.mts`.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The instance files this module reads by default. */
export const INSTANCES_DIR = fileURLToPath(new URL('../instances/', import.meta.url))

/** Where a site is served before its own domain: GitHub Pages, one path per repository. */
export const DEMO_ORIGIN = 'https://museumwithnofrontiers.github.io'

/** The route of an item's page, unless the instance file names another. */
export const DEFAULT_ITEM_PATH = '/item/:id'

/** The pages of the two M14 sites other packages link to. */
export const PUBLICATION_PATH = '/publication/:id'
export const TRAIL_PATH = '/trail/:id'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
/** A site's slug: lowercase letters and digits, in words joined by single hyphens. */
export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const SHEET_TYPES = ['object', 'monument']
const TREE_TYPES = ['object', 'monument', 'detail']
// Bound on the length of one `IN (…)` list.
const CHUNK = 500

/**
 * @param {string} path
 * @param {unknown} data
 * @returns {import('./sites.d.mts').SiteRule | null}
 */
function ruleOf(path, data) {
  const record = /** @type {Record<string, unknown>} */ (data)
  const kind = record['kind']
  const collectionId = record['collection_id']
  if (kind === 'gallery' || kind === 'exhibition' || kind === 'minisite') {
    if (typeof collectionId !== 'string' || !UUID.test(collectionId)) {
      throw new Error(`Instance file ${path}: "collection_id" must be a lowercase UUID.`)
    }
    return kind === 'minisite' ? { type: 'subtree', collectionId } : { type: 'collection', collectionId }
  }
  if (kind === 'search') return null
  if (kind !== 'standalone') throw new Error(`Instance file ${path}: unknown "kind" ${JSON.stringify(kind)}.`)

  const projectIds = record['project_ids']
  const scope = record['item_scope']
  if (projectIds !== undefined && scope !== undefined) {
    throw new Error(`Instance file ${path}: "project_ids" and "item_scope" are two rules; a site has one.`)
  }
  if (projectIds !== undefined) {
    if (!Array.isArray(projectIds) || projectIds.some(id => typeof id !== 'string' || !UUID.test(id))) {
      throw new Error(`Instance file ${path}: "project_ids" must be an array of lowercase UUIDs.`)
    }
    return { type: 'project', projectIds: [...projectIds] }
  }
  if (scope !== undefined) {
    const s = /** @type {Record<string, unknown>} */ (scope)
    const rootPurpose = s?.['root_purpose']
    const memberOf = s?.['member_of']
    if (typeof rootPurpose !== 'string' || rootPurpose === '') {
      throw new Error(`Instance file ${path}: "item_scope.root_purpose" must be a collection purpose.`)
    }
    if (memberOf !== undefined && (!Array.isArray(memberOf) || memberOf.some(t => typeof t !== 'string'))) {
      throw new Error(`Instance file ${path}: "item_scope.member_of" must be an array of collection types.`)
    }
    return { type: 'tree', rootPurpose, memberOf: memberOf === undefined ? null : [...memberOf] }
  }
  return null
}

/**
 * Every site of the instance files, sorted by file name.
 *
 * @param {string} [dir]
 * @returns {import('./sites.d.mts').Site[]}
 */
export function loadSites(dir = INSTANCES_DIR) {
  const sites = []
  for (const file of readdirSync(dir).filter(name => name.endsWith('.json')).sort()) {
    const path = join(dir, file)
    let data
    try {
      data = JSON.parse(readFileSync(path, 'utf-8'))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`Invalid JSON in instance file ${path}: ${message}`, { cause: err })
    }
    const slug = data?.slug
    // The global search site takes a slug from its address and looks it up
    // in the list built from these files (M15): a slug of this shape is the
    // only thing it can ever turn into a link, so the shape is enforced here.
    if (typeof slug !== 'string' || !SLUG.test(slug)) {
      throw new Error(`Instance file ${path}: "slug" must be lowercase words joined by single hyphens.`)
    }
    const origin = data.origin ?? `${DEMO_ORIGIN}/${slug}`
    if (typeof origin !== 'string' || !/^https:\/\/[^/]+(\/[^/]+)*$/.test(origin)) {
      throw new Error(`Instance file ${path}: "origin" must be an https address with no trailing slash.`)
    }
    const itemPath = data.item_path ?? DEFAULT_ITEM_PATH
    if (typeof itemPath !== 'string' || !itemPath.startsWith('/') || !itemPath.includes(':id')) {
      throw new Error(`Instance file ${path}: "item_path" must be a route with ":id".`)
    }
    const name = typeof data.name === 'string' && data.name !== '' ? data.name : slug
    const parent = typeof data.parent === 'string' && data.parent !== '' ? data.parent : null
    sites.push({ slug, kind: data.kind, name, parent, origin, itemPath, rule: ruleOf(path, data) })
  }
  return sites
}

/**
 * The site of a slug.
 *
 * @param {string} slug
 * @param {import('./sites.d.mts').Site[]} sites
 * @returns {import('./sites.d.mts').Site}
 */
export function siteOf(slug, sites) {
  const site = sites.find(s => s.slug === slug)
  if (!site) throw new Error(`No instance file for the site "${slug}".`)
  return site
}

/**
 * A page of a site: its route and its address.
 *
 * @param {import('./sites.d.mts').Site} site
 * @param {string} route a route with `:id`, such as `/item/:id`
 * @param {string} id
 * @returns {import('./sites.d.mts').SiteLink}
 */
export function siteLink(site, route, id) {
  const path = route.replace(':id', id)
  return { site: site.slug, path, url: `${site.origin}/#${path}` }
}

/**
 * Whether `ancestorId` is the collection or one above it.
 *
 * @param {string} collectionId
 * @param {string} ancestorId
 * @param {ReadonlyMap<string, import('./sites.d.mts').CollectionFacts>} collections
 */
function isWithin(collectionId, ancestorId, collections) {
  const seen = new Set()
  for (let id = /** @type {string | null} */ (collectionId); id && !seen.has(id); id = collections.get(id)?.parent_id ?? null) {
    if (id === ancestorId) return true
    seen.add(id)
  }
  return false
}

/**
 * Whether the collection is under a collection of that purpose.
 *
 * @param {string} collectionId
 * @param {string} purpose
 * @param {ReadonlyMap<string, import('./sites.d.mts').CollectionFacts>} collections
 */
function isUnderPurpose(collectionId, purpose, collections) {
  const seen = new Set()
  for (let id = /** @type {string | null} */ (collectionId); id && !seen.has(id); id = collections.get(id)?.parent_id ?? null) {
    if (collections.get(id)?.purpose === purpose) return true
    seen.add(id)
  }
  return false
}

/**
 * Whether one site shows the item.
 *
 * @param {import('./sites.d.mts').SiteRule} rule
 * @param {import('./sites.d.mts').ItemFacts} item
 * @param {ReadonlyMap<string, import('./sites.d.mts').CollectionFacts>} collections
 */
function shows(rule, item, collections) {
  switch (rule.type) {
    case 'project':
      return SHEET_TYPES.includes(item.type) && item.project_id !== null && rule.projectIds.includes(item.project_id)
    case 'collection':
      return (
        SHEET_TYPES.includes(item.type) &&
        item.memberships.some(m => !m.viaPicture && m.collection_id === rule.collectionId)
      )
    case 'subtree':
      return item.memberships.some(m => isWithin(m.collection_id, rule.collectionId, collections))
    case 'tree':
      return (
        TREE_TYPES.includes(item.type) &&
        item.memberships.some(
          m =>
            !m.viaPicture &&
            (rule.memberOf === null || rule.memberOf.includes(collections.get(m.collection_id)?.type ?? '')) &&
            isUnderPurpose(m.collection_id, rule.rootPurpose, collections)
        )
      )
  }
}

/**
 * The sites that show one item, its home site (a project rule) first, then
 * the others in the order of `sites`.
 *
 * @param {import('./sites.d.mts').ItemFacts} item
 * @param {import('./sites.d.mts').Site[]} sites
 * @param {ReadonlyMap<string, import('./sites.d.mts').CollectionFacts>} collections
 * @returns {import('./sites.d.mts').SiteLink[]}
 */
export function sitesShowing(item, sites, collections) {
  const showing = sites.filter(site => site.rule !== null && shows(site.rule, item, collections))
  const home = showing.filter(site => site.rule?.type === 'project')
  const others = showing.filter(site => site.rule?.type !== 'project')
  return [...home, ...others].map(site => siteLink(site, site.itemPath, item.id))
}

/**
 * @template T
 * @param {T[]} values
 * @returns {T[][]}
 */
function chunks(values) {
  const out = []
  for (let i = 0; i < values.length; i += CHUNK) out.push(values.slice(i, i + CHUNK))
  return out
}

/** @param {unknown[]} values */
const marks = values => values.map(() => '?').join(', ')

/**
 * What the rule needs to know about each item, read from the database: its
 * type and project, the collections it is a member of (or one of its
 * pictures is), and those collections' ancestry.
 *
 * @param {import('./sites.d.mts').Query} query
 * @param {string[]} itemIds
 * @returns {Promise<{ items: Map<string, import('./sites.d.mts').ItemFacts>, collections: Map<string, import('./sites.d.mts').CollectionFacts> }>}
 */
export async function readItemFacts(query, itemIds) {
  const ids = [...new Set(itemIds)].sort()
  /** @type {Map<string, import('./sites.d.mts').ItemFacts>} */
  const items = new Map()
  /** @type {Map<string, import('./sites.d.mts').CollectionFacts>} */
  const collections = new Map()
  for (const part of chunks(ids)) {
    const rows = /** @type {{ id: string, type: string, project_id: string | null }[]} */ (
      await query(`SELECT id, type, project_id FROM items WHERE id IN (${marks(part)}) ORDER BY id`, part)
    )
    for (const row of rows) items.set(row.id, { id: row.id, type: row.type, project_id: row.project_id, memberships: [] })
    const memberships = /** @type {{ item_id: string, collection_id: string, via_picture: number }[]} */ (
      await query(
        `SELECT ci.item_id, ci.collection_id, 0 AS via_picture
         FROM collection_item ci
         WHERE ci.item_id IN (${marks(part)})
         UNION ALL
         SELECT p.parent_id AS item_id, ci.collection_id, 1 AS via_picture
         FROM collection_item ci
         JOIN items p ON p.id = ci.item_id
         WHERE p.type = 'picture' AND p.parent_id IN (${marks(part)})
         ORDER BY item_id, collection_id, via_picture`,
        [...part, ...part]
      )
    )
    for (const row of memberships) {
      items.get(row.item_id)?.memberships.push({ collection_id: row.collection_id, viaPicture: Number(row.via_picture) === 1 })
    }
  }

  let level = [...new Set([...items.values()].flatMap(item => item.memberships.map(m => m.collection_id)))]
  while (level.length > 0) {
    const next = []
    for (const part of chunks(level.sort())) {
      const rows = /** @type {import('./sites.d.mts').CollectionFacts[]} */ (
        await query(`SELECT id, parent_id, type, purpose FROM collections WHERE id IN (${marks(part)}) ORDER BY id`, part)
      )
      for (const row of rows) {
        collections.set(row.id, { id: row.id, parent_id: row.parent_id, type: row.type, purpose: row.purpose })
        if (row.parent_id && !collections.has(row.parent_id)) next.push(row.parent_id)
      }
    }
    level = [...new Set(next)].filter(id => !collections.has(id))
  }
  return { items, collections }
}

/**
 * The sites that show each item, by item id. An id the database does not
 * know maps to no site.
 *
 * @param {import('./sites.d.mts').Query} query
 * @param {string[]} itemIds
 * @param {import('./sites.d.mts').Site[]} [sites]
 * @returns {Promise<Map<string, import('./sites.d.mts').SiteLink[]>>}
 */
export async function resolveItemSites(query, itemIds, sites = loadSites()) {
  const { items, collections } = await readItemFacts(query, itemIds)
  const out = new Map()
  for (const id of itemIds) {
    const item = items.get(id)
    out.set(id, item ? sitesShowing(item, sites, collections) : [])
  }
  return out
}

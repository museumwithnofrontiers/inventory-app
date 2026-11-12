import type { Database } from './database.js'

/**
 * What the Travels package ships, resolved once and shared by every exporter.
 *
 * Travels is the Exhibition Trails of travels.museumwnf.org: a collection
 * tree in the Travels context under the site root (purpose `travels-root`) —
 * trails, their itineraries, the itineraries' locations — and the monuments
 * the locations hold, which are the site's own items. Legacy shows the whole
 * tree, so unlike Explore's (whose exporter this forks) nothing in it is
 * hidden.
 *
 * A trail's own members are its entries: Islamic Art's objects and monuments,
 * which stay that site's records. They ship as references, never as items.
 */
export interface TravelsScope {
  travelsContextId: string
  rootId: string
  /** The tree, parents before children, siblings in display order. */
  collectionIds: string[]
  /** The exhibition trails among them, in tree order. */
  trailIds: string[]
  /** The site's own items: the locations' members (and their own details). */
  itemIds: string[]
  /** Each trail's entries, in order. */
  entriesByTrail: Map<string, string[]>
  /** Every trail entry, sorted. */
  entryIds: string[]
  /** The projects of the site's items. */
  projectIds: string[]
  /** The partners the trails name: each trail's "Starting point" museum. */
  partnerIds: string[]
  /** The Travels context, then every other context the items are translated in. */
  contextIds: string[]
}

export const TRAVELS_CONTEXT_KEY = 'mwnf3_travels:context'
export const TRAVELS_ROOT_PURPOSE = 'travels-root'
export const TRAIL_TYPE = 'exhibition trail'

export interface TreeCollection {
  id: string
  parent_id: string | null
  type: string
  display_order: number | null
  internal_name: string
}

/**
 * The tree under the root, parents first and siblings in their display
 * order. Every descendant ships: Travels hides none.
 */
export function shippedTree(rootId: string, collections: TreeCollection[]): TreeCollection[] {
  const byId = new Map(collections.map(c => [c.id, c]))
  const children = new Map<string, TreeCollection[]>()
  for (const c of collections) {
    if (!c.parent_id) continue
    children.set(c.parent_id, [...(children.get(c.parent_id) ?? []), c])
  }
  const order = (a: TreeCollection, b: TreeCollection) =>
    (a.display_order ?? Number.MAX_SAFE_INTEGER) - (b.display_order ?? Number.MAX_SAFE_INTEGER) ||
    a.internal_name.localeCompare(b.internal_name) ||
    a.id.localeCompare(b.id)

  const root = byId.get(rootId)
  if (!root) return []
  const shipped: TreeCollection[] = []
  const seen = new Set<string>()
  const queue: TreeCollection[] = [root]
  while (queue.length > 0) {
    const collection = queue.shift()!
    if (seen.has(collection.id)) continue
    seen.add(collection.id)
    shipped.push(collection)
    queue.push(...[...(children.get(collection.id) ?? [])].sort(order))
  }
  return shipped
}

const marks = (values: unknown[]) => values.map(() => '?').join(', ')

export async function resolveScope(db: Pick<Database, 'query'>): Promise<TravelsScope> {
  const contexts = await db.query<{ id: string }>(`SELECT id FROM contexts WHERE backward_compatibility = ?`, [
    TRAVELS_CONTEXT_KEY,
  ])
  const travelsContextId = contexts[0]?.id
  if (!travelsContextId) throw new Error(`The Travels context (${TRAVELS_CONTEXT_KEY}) is missing`)

  const rows = await db.query<TreeCollection & { purpose: string | null }>(
    `SELECT id, parent_id, type, purpose, display_order, internal_name
     FROM collections
     WHERE context_id = ?
     ORDER BY id`,
    [travelsContextId]
  )
  const roots = rows.filter(r => r.purpose === TRAVELS_ROOT_PURPOSE)
  if (roots.length !== 1) {
    throw new Error(`Expected one collection with purpose '${TRAVELS_ROOT_PURPOSE}', found ${roots.length}`)
  }
  const rootId = roots[0]!.id
  const tree = shippedTree(rootId, rows)
  const collectionIds = tree.map(c => c.id)
  const trailIds = tree.filter(c => c.type === TRAIL_TYPE).map(c => c.id)
  const locationIds = tree.filter(c => c.type === 'location').map(c => c.id)

  // The site's items are the locations' members, as the shared site rule
  // (`instances/travels.json`, `item_scope.member_of`) says.
  const members =
    locationIds.length === 0
      ? []
      : await db.query<{ id: string; project_id: string | null }>(
          `SELECT DISTINCT i.id, i.project_id
           FROM collection_item ci
           JOIN items i ON i.id = ci.item_id
           WHERE ci.collection_id IN (${marks(locationIds)})
             AND i.type IN ('object', 'monument', 'detail')
           ORDER BY i.id`,
          locationIds
        )
  const memberIds = members.map(i => i.id)
  const details =
    memberIds.length === 0
      ? []
      : await db.query<{ id: string; project_id: string | null }>(
          `SELECT id, project_id FROM items
           WHERE parent_id IN (${marks(memberIds)}) AND type = 'detail'
           ORDER BY id`,
          memberIds
        )
  const items = [...new Map([...members, ...details].map(i => [i.id, i])).values()].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  )
  const itemIds = items.map(i => i.id)
  const projectIds = [...new Set(items.map(i => i.project_id).filter((p): p is string => !!p))].sort()

  const entries =
    trailIds.length === 0
      ? []
      : await db.query<{ collection_id: string; item_id: string }>(
          `SELECT ci.collection_id, ci.item_id
           FROM collection_item ci
           JOIN items i ON i.id = ci.item_id
           WHERE ci.collection_id IN (${marks(trailIds)})
             AND i.type IN ('object', 'monument')
           ORDER BY ci.collection_id, ci.display_order IS NULL, ci.display_order, ci.item_id`,
          trailIds
        )
  const entriesByTrail = new Map<string, string[]>()
  for (const entry of entries) {
    entriesByTrail.set(entry.collection_id, [...(entriesByTrail.get(entry.collection_id) ?? []), entry.item_id])
  }
  const entryIds = [...new Set(entries.map(e => e.item_id))].sort()

  const partners =
    trailIds.length === 0
      ? []
      : await db.query<{ partner_id: string }>(
          `SELECT DISTINCT partner_id FROM collection_partner
           WHERE collection_id IN (${marks(trailIds)})
           ORDER BY partner_id`,
          trailIds
        )

  // The items' texts: the Travels context's, then their projects' own. Not
  // every context they are written in: Explore writes its own name for the
  // Travels monuments it shows, which is Explore's, not this site's.
  const translated =
    projectIds.length === 0
      ? []
      : await db.query<{ context_id: string }>(
          `SELECT DISTINCT context_id FROM projects
           WHERE id IN (${marks(projectIds)}) AND context_id IS NOT NULL
           ORDER BY context_id`,
          projectIds
        )

  return {
    travelsContextId,
    rootId,
    collectionIds,
    trailIds,
    itemIds,
    entriesByTrail,
    entryIds,
    projectIds,
    partnerIds: partners.map(p => p.partner_id),
    contextIds: [travelsContextId, ...translated.map(c => c.context_id).filter(c => c !== travelsContextId)],
  }
}

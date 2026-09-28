import type { Database } from './database.js'

/**
 * What the Explore package ships, resolved once and shared by every exporter.
 *
 * Explore is not a project: its collections live in the Explore context under
 * the site root (purpose `explore-root`), and most of its monuments are other
 * databases' records that Explore's locations, themes and itineraries point
 * at. So the scope is the collection tree, and the items are its members.
 */
export interface ExploreScope {
  exploreContextId: string
  rootId: string
  /** The collections shipped, parents before children. */
  collectionIds: string[]
  /**
   * Their member items (monuments, objects and details), the members' own
   * details, and the records the members link to.
   */
  itemIds: string[]
  /** The projects those items belong to. */
  projectIds: string[]
  /** The Explore context, then every other context the items are translated in. */
  contextIds: string[]
}

export const EXPLORE_CONTEXT_KEY = 'mwnf3_explore:context'
export const EXPLORE_ROOT_PURPOSE = 'explore-root'

export interface TreeCollection {
  id: string
  parent_id: string | null
  type: string
  purpose: string | null
  display_order: number | null
  internal_name: string
  /** `collections.extra`, parsed. */
  extra: Record<string, unknown> | null
  /** The English translation's `extra`, parsed. */
  english_extra: Record<string, unknown> | null
}

function objectAt(value: unknown, key: string): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  const inner = (value as Record<string, unknown>)[key]
  return inner && typeof inner === 'object' ? (inner as Record<string, unknown>) : null
}

/**
 * Whether legacy shows a collection, per the Explore analysis
 * (`scripts/exporters/docs/explore-legacy-analysis.md`):
 * - a theme only when its status is `e` (6 of the 11 thematic cycles);
 * - an itinerary only when it is Explore's own (`explore_itinerary`), not the
 *   old site's;
 * - under the itineraries root, a thematic itinerary (legacy type 4), and a
 *   location route (types 1–3) only when it is linked to a location — legacy
 *   reaches a route from its location's page, so one without a location is
 *   never shown.
 * Every other collection of the tree is shown.
 */
export function isShown(collection: TreeCollection, parent: TreeCollection | null): boolean {
  if (collection.type === 'theme') {
    return collection.english_extra?.['legacy_status'] === 'e'
  }
  const itinerary = objectAt(collection.extra, 'explore_itinerary')
  // The old Explore site's itineraries (legacy `itineraries`,
  // `mwnf3_explore:old_itinerary:*`) are not the live site's, and carry no
  // `explore_itinerary`. The itineraries root carries none either: it is a
  // section, known by its purpose.
  if (
    (collection.type === 'itinerary' || collection.type === 'exhibition trail') &&
    collection.purpose === null &&
    itinerary === null
  ) {
    return false
  }
  // A top-level itinerary: its parent, the itineraries root, is no itinerary
  // of legacy's. A sub-itinerary shows with its itinerary.
  if (itinerary && parent && objectAt(parent.extra, 'explore_itinerary') === null) {
    if (itinerary['type'] === '4') return true
    const locations = collection.english_extra?.['location_ids']
    return Array.isArray(locations) && locations.length > 0
  }
  return true
}

/**
 * The shipped collections, parents first and siblings in their display
 * order: the root and every descendant legacy shows. A hidden collection
 * hides its whole subtree.
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
  const queue: TreeCollection[] = [root]
  while (queue.length > 0) {
    const collection = queue.shift()!
    shipped.push(collection)
    for (const child of [...(children.get(collection.id) ?? [])].sort(order)) {
      if (isShown(child, collection)) queue.push(child)
    }
  }
  return shipped
}

function parse(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null
  if (typeof raw === 'object') return raw as Record<string, unknown>
  try {
    return JSON.parse(raw as string) as Record<string, unknown>
  } catch {
    return null
  }
}

export async function resolveScope(db: Database): Promise<ExploreScope> {
  const contexts = await db.query<{ id: string }>(
    `SELECT id FROM contexts WHERE backward_compatibility = ?`,
    [EXPLORE_CONTEXT_KEY]
  )
  const exploreContextId = contexts[0]?.id
  if (!exploreContextId) throw new Error(`The Explore context (${EXPLORE_CONTEXT_KEY}) is missing`)

  const rows = await db.query<{
    id: string
    parent_id: string | null
    type: string
    purpose: string | null
    display_order: number | null
    internal_name: string
    extra: unknown
    english_extra: unknown
  }>(
    `SELECT c.id, c.parent_id, c.type, c.purpose, c.display_order, c.internal_name, c.extra,
            ct.extra AS english_extra
     FROM collections c
     LEFT JOIN collection_translations ct
       ON ct.collection_id = c.id AND ct.language_id = 'eng' AND ct.context_id = c.context_id
     WHERE c.context_id = ?
     ORDER BY c.id`,
    [exploreContextId]
  )
  const roots = rows.filter(r => r.purpose === EXPLORE_ROOT_PURPOSE)
  if (roots.length !== 1) {
    throw new Error(
      `Expected one collection with purpose '${EXPLORE_ROOT_PURPOSE}', found ${roots.length}`
    )
  }
  const rootId = roots[0]!.id

  const tree = shippedTree(
    rootId,
    rows.map(r => ({
      id: r.id,
      parent_id: r.parent_id,
      type: r.type,
      purpose: r.purpose,
      display_order: r.display_order,
      internal_name: r.internal_name,
      extra: parse(r.extra),
      english_extra: parse(r.english_extra),
    }))
  )
  const collectionIds = tree.map(c => c.id)

  const ph = collectionIds.map(() => '?').join(', ')
  const members = await db.query<{ id: string; project_id: string | null }>(
    `SELECT DISTINCT i.id, i.project_id
     FROM collection_item ci
     JOIN items i ON i.id = ci.item_id
     WHERE ci.collection_id IN (${ph})
       AND i.type IN ('object', 'monument', 'detail')
     ORDER BY i.id`,
    collectionIds
  )
  // A monument sheet also shows its details (legacy's "Special Features")
  // and the records it links to (its "Virtual Museum", Travels and Sharing
  // History related content): they ship too, one hop out.
  const memberIds = members.map(i => i.id)
  const details =
    memberIds.length === 0
      ? []
      : await db.query<{ id: string; project_id: string | null }>(
          `SELECT id, project_id FROM items
           WHERE parent_id IN (${memberIds.map(() => '?').join(', ')}) AND type = 'detail'
           ORDER BY id`,
          memberIds
        )
  const sourceIds = [...memberIds, ...details.map(i => i.id)]
  const linked =
    sourceIds.length === 0
      ? []
      : await db.query<{ id: string; project_id: string | null }>(
          `SELECT DISTINCT i.id, i.project_id
           FROM item_item_links l
           JOIN items i ON i.id = l.target_id
           WHERE l.source_id IN (${sourceIds.map(() => '?').join(', ')})
             AND i.type IN ('object', 'monument', 'detail')
           ORDER BY i.id`,
          sourceIds
        )
  const items = [...new Map([...members, ...details, ...linked].map(i => [i.id, i])).values()].sort(
    (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
  const itemIds = items.map(i => i.id)
  const projectIds = [
    ...new Set(items.map(i => i.project_id).filter((p): p is string => !!p)),
  ].sort()

  // Every context the items are translated in: their projects', and the
  // Travels context for its records, which belong to no project.
  const translated =
    itemIds.length === 0
      ? []
      : await db.query<{ context_id: string }>(
          `SELECT DISTINCT context_id FROM item_translations
           WHERE item_id IN (${itemIds.map(() => '?').join(', ')})
           ORDER BY context_id`,
          itemIds
        )
  const itemContextIds = translated.map(c => c.context_id).filter(c => c !== exploreContextId)

  return {
    exploreContextId,
    rootId,
    collectionIds,
    itemIds,
    projectIds,
    contextIds: [exploreContextId, ...itemContextIds],
  }
}

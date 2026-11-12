import { trailLinks, type TrailLink } from '../../../shared/links.mjs'
import { loadSites, type Site } from '../../../shared/sites.mjs'
import type { Database } from './database.js'

/**
 * Legacy's "Related exhibition trails" on a Discover Baroque Art item sheet
 * (`database_item.php`, M14 D4, #2538, #2451): the Exhibition Trails the item
 * is an entry of (legacy `objects_trails`, `monuments_trails`), each titled
 * "<title> - <subtitle>" and linked to its page, now on the Travels site.
 *
 * The importer keeps those entries as the trails' own members
 * (`collection_item`), so this reads the stored relation: the Travels trails
 * the item belongs to. Explore's own trails share the collection type, never
 * the Travels context.
 */
export const TRAVELS_CONTEXT_KEY = 'mwnf3_travels:context'

export async function trailsByItem(
  db: Pick<Database, 'query'>,
  itemIds: string[],
  sites: Site[] = loadSites()
): Promise<Map<string, TrailLink[]>> {
  const out = new Map<string, TrailLink[]>()
  if (itemIds.length === 0) return out
  const rows = await db.query<{ item_id: string; collection_id: string }>(
    `SELECT ci.item_id, ci.collection_id
     FROM collection_item ci
     JOIN collections c ON c.id = ci.collection_id
     JOIN contexts ctx ON ctx.id = c.context_id
     WHERE c.type = 'exhibition trail'
       AND ctx.backward_compatibility = ?
       AND ci.item_id IN (${itemIds.map(() => '?').join(', ')})
     ORDER BY ci.item_id, c.backward_compatibility, c.id`,
    [TRAVELS_CONTEXT_KEY, ...itemIds]
  )
  if (rows.length === 0) return out
  const links = await trailLinks((sql, params) => db.query(sql, params), [...new Set(rows.map(r => r.collection_id))], sites)
  const linkById = new Map(links.map(link => [link.id, link]))
  for (const row of rows) {
    const link = linkById.get(row.collection_id)
    if (link) out.set(row.item_id, [...(out.get(row.item_id) ?? []), link])
  }
  return out
}

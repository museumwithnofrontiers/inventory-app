import type { Database } from '../core/database.js'
import type { ExportScope } from '../core/types.js'
import type { MinisiteInstance } from './instance.js'

type Query = Pick<Database, 'query'>

const placeholders = (values: unknown[]): string => values.map(() => '?').join(', ')

/**
 * A mini-site's scope, read from the database:
 * - its exhibition and every theme and subtheme below it;
 * - the items those collections place and their parent records (a detail's
 *   monument), so a caption can name and link its record;
 * - the partners those items name (a caption's museum), and the partners the
 *   instance names itself.
 */
export async function resolveScope(db: Query, instance: MinisiteInstance): Promise<ExportScope> {
  const [root] = await db.query<{ id: string }>(`SELECT id FROM collections WHERE id = ?`, [instance.collectionId])
  if (!root) throw new Error(`No collection ${instance.collectionId}`)

  const collectionIds = [root.id]
  for (let level = [root.id]; level.length > 0; ) {
    const children = await db.query<{ id: string }>(
      `SELECT id FROM collections WHERE parent_id IN (${placeholders(level)}) ORDER BY id`,
      level
    )
    level = children.map(c => c.id).filter(id => !collectionIds.includes(id))
    collectionIds.push(...level)
  }

  const placed = await db.query<{ id: string | null }>(
    `SELECT DISTINCT IF(i.type = 'picture' AND i.parent_id IS NOT NULL, i.parent_id, i.id) AS id
     FROM collection_item ci
     JOIN items i ON i.id = ci.item_id
     WHERE ci.collection_id IN (${placeholders(collectionIds)})`,
    collectionIds
  )
  const itemIds = new Set(placed.map(r => r.id).filter((id): id is string => !!id))
  for (let level = [...itemIds]; level.length > 0; ) {
    const parents = await db.query<{ id: string }>(
      `SELECT DISTINCT parent_id AS id FROM items
       WHERE id IN (${placeholders(level)}) AND parent_id IS NOT NULL`,
      level
    )
    level = parents.map(p => p.id).filter(id => !itemIds.has(id))
    for (const id of level) itemIds.add(id)
  }

  const named =
    instance.partnerIds.length > 0
      ? await db.query<{ id: string }>(
          `SELECT id FROM partners WHERE id IN (${placeholders(instance.partnerIds)})`,
          instance.partnerIds
        )
      : []
  const missing = instance.partnerIds.filter(id => !named.some(p => p.id === id))
  if (missing.length > 0) throw new Error(`No partner ${missing.join(', ')}`)
  const holders =
    itemIds.size > 0
      ? await db.query<{ id: string }>(
          `SELECT DISTINCT partner_id AS id FROM items
           WHERE id IN (${placeholders([...itemIds])}) AND partner_id IS NOT NULL`,
          [...itemIds]
        )
      : []
  const partnerIds = [...new Set([...instance.partnerIds, ...holders.map(p => p.id)])].sort()

  return {
    key: instance.slug,
    rootCollectionId: root.id,
    legacyUrl: instance.legacyUrl,
    parentKey: instance.parent,
    collectionIds,
    itemIds: [...itemIds].sort(),
    partnerIds,
  }
}

import type { Database } from './database.js'

type Query = Pick<Database, 'query'>

/**
 * What the Publications package ships, resolved once and shared by every
 * exporter.
 *
 * Publications is no project and no collection tree: it is every
 * publication, the exhibition trails they accompany (`publication_collection`)
 * and, as references only, the items they catalogue (`publication_item`) and
 * their trails' entries (the trails' own members). A publication reaches a
 * trail entry through its trail; the importer stores no second row for it.
 */
export interface PublicationsScope {
  /** Every publication, in display order. */
  publicationIds: string[]
  /** The publications' projects. */
  projectIds: string[]
  /** Each publication's trails, in order. */
  trailsByPublication: Map<string, string[]>
  /** Each publication's catalogue items, in order. */
  catalogueByPublication: Map<string, string[]>
  /** The trails, sorted. */
  trailIds: string[]
  /** Each trail's entries, in order. */
  entriesByTrail: Map<string, string[]>
  /** Every item referenced, the catalogue items and the trail entries, sorted. */
  referenceIds: string[]
}

const marks = (values: unknown[]) => values.map(() => '?').join(', ')

function group(rows: { key: string; value: string }[]): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const row of rows) {
    const list = out.get(row.key) ?? []
    if (!list.includes(row.value)) list.push(row.value)
    out.set(row.key, list)
  }
  return out
}

export async function resolveScope(db: Query): Promise<PublicationsScope> {
  const publications = await db.query<{ id: string; project_id: string | null }>(
    `SELECT id, project_id FROM publications
     ORDER BY display_order IS NULL, display_order, internal_name, id`
  )
  const publicationIds = publications.map(p => p.id)
  const projectIds = [...new Set(publications.map(p => p.project_id).filter((p): p is string => !!p))].sort()

  const trailRows = await db.query<{ key: string; value: string }>(
    `SELECT publication_id AS \`key\`, collection_id AS value FROM publication_collection
     ORDER BY publication_id, display_order IS NULL, display_order, collection_id`
  )
  const catalogueRows = await db.query<{ key: string; value: string }>(
    `SELECT publication_id AS \`key\`, item_id AS value FROM publication_item
     ORDER BY publication_id, display_order IS NULL, display_order, item_id`
  )
  const trailsByPublication = group(trailRows)
  const catalogueByPublication = group(catalogueRows)
  const trailIds = [...new Set(trailRows.map(r => r.value))].sort()

  // A trail's own members are its entries: its monuments hang on its
  // locations, never on the trail itself.
  const entryRows =
    trailIds.length === 0
      ? []
      : await db.query<{ key: string; value: string }>(
          `SELECT ci.collection_id AS \`key\`, ci.item_id AS value
           FROM collection_item ci
           JOIN items i ON i.id = ci.item_id
           WHERE ci.collection_id IN (${marks(trailIds)})
             AND i.type IN ('object', 'monument')
           ORDER BY ci.collection_id, ci.display_order IS NULL, ci.display_order, ci.item_id`,
          trailIds
        )
  const entriesByTrail = group(entryRows)

  const referenceIds = [...new Set([...catalogueRows.map(r => r.value), ...entryRows.map(r => r.value)])].sort()

  return {
    publicationIds,
    projectIds,
    trailsByPublication,
    catalogueByPublication,
    trailIds,
    entriesByTrail,
    referenceIds,
  }
}

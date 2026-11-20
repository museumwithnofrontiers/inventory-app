// @ts-check
/**
 * A project's own root collection, the one keyed like the project
 * (`mwnf3:projects:ISL`), is the importer's home for the project's items and
 * partners, not a page of a site: a site reaches its collections through the
 * purpose markers below it (`exhibitions-root`, `artistic-introduction-root`).
 * The project-scoped packages leave it out, and the markers below it then hang
 * from nothing (M16 J5, inventory-app#2707).
 *
 * Types are in `project-roots.d.mts`.
 */

/** @param {unknown[]} values */
const marks = values => values.map(() => '?').join(', ')

/**
 * The ids of the exported projects' own root collections.
 *
 * @param {(sql: string, params?: (string | number | null)[]) => Promise<unknown[]>} query
 * @param {string[]} projectIds
 * @returns {Promise<Set<string>>}
 */
export async function projectRootIds(query, projectIds) {
  if (projectIds.length === 0) return new Set()
  const rows = /** @type {{ id: string }[]} */ (
    await query(
      `SELECT c.id
       FROM collections c
       JOIN projects p ON p.context_id = c.context_id AND p.backward_compatibility = c.backward_compatibility
       WHERE c.parent_id IS NULL AND p.id IN (${marks(projectIds)})
       ORDER BY c.id`,
      projectIds
    )
  )
  return new Set(rows.map(row => row.id))
}

/**
 * The collections without the project roots; a collection directly under one
 * gets no parent.
 *
 * @template {{ id: string, parent_id: string | null }} T
 * @param {T[]} collections
 * @param {ReadonlySet<string>} rootIds
 * @returns {T[]}
 */
export function dropProjectRoots(collections, rootIds) {
  if (rootIds.size === 0) return collections
  return collections
    .filter(c => !rootIds.has(c.id))
    .map(c => (c.parent_id !== null && rootIds.has(c.parent_id) ? { ...c, parent_id: null } : c))
}

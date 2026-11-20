/** Types of `project-roots.mjs`. */

export function projectRootIds(
  query: (sql: string, params?: (string | number | null)[]) => Promise<unknown[]>,
  projectIds: string[]
): Promise<Set<string>>

export function dropProjectRoots<T extends { id: string; parent_id: string | null }>(
  collections: T[],
  rootIds: ReadonlySet<string>
): T[]

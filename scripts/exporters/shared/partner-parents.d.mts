/** Types of `partner-parents.mjs`. */

export function partnerParents(
  query: (sql: string, params?: (string | number | null)[]) => Promise<unknown[]>,
  projectIds: string[],
  partnerIds: string[]
): Promise<Map<string, string>>

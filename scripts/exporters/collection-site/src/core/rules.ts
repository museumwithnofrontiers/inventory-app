/**
 * The rules a collection site is built by (inventory-app#2727, R1–R8), as
 * pure functions over rows, so they are tested without a database.
 *
 * Every rule uses the inventory's own concepts only: collections and their
 * tree, placements (`collection_item`), contexts, Projects, partners and
 * links. No legacy key, legacy setting or legacy-shaped value is read.
 */

export interface TreeRow {
  id: string
  parent_id: string | null
}

/**
 * R1, scope: the root collection and every collection below it, any depth,
 * parents before children. Collections in `excluded` (the drafts and
 * everything under them) are left out together with their subtree.
 */
export function collectTree<T extends TreeRow>(rows: T[], rootId: string, excluded: Set<string> = new Set()): T[] {
  const byParent = new Map<string, T[]>()
  for (const row of rows) {
    if (row.parent_id === null) continue
    const siblings = byParent.get(row.parent_id)
    if (siblings) siblings.push(row)
    else byParent.set(row.parent_id, [row])
  }
  const root = rows.find(row => row.id === rootId)
  if (!root || excluded.has(root.id)) return []
  const out: T[] = []
  const seen = new Set<string>()
  const queue: T[] = [root]
  while (queue.length > 0) {
    const row = queue.shift()!
    if (seen.has(row.id) || excluded.has(row.id)) continue
    seen.add(row.id)
    out.push(row)
    queue.push(...(byParent.get(row.id) ?? []))
  }
  return out
}

export interface PlacedItem {
  id: string
  type: string
  parent_id: string | null
}

/**
 * R2, members: the items placed anywhere in the tree. A placed picture
 * stands for its parent item (the picture itself ships as that item's
 * picture), and so does a placed detail. Returns the member ids, in the
 * order they were first met.
 */
export function memberIds(placed: PlacedItem[], byId: Map<string, PlacedItem>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of placed) {
    const member = topOf(item, byId)
    if (!seen.has(member.id)) {
      seen.add(member.id)
      out.push(member.id)
    }
  }
  return out
}

/** The object or monument an item belongs to: itself, its parent, or its grandparent. */
export function topOf(item: PlacedItem, byId: Map<string, PlacedItem>): PlacedItem {
  let current = item
  for (let depth = 0; depth < 3 && current.parent_id !== null; depth++) {
    const parent = byId.get(current.parent_id)
    if (!parent) break
    current = parent
  }
  return current
}

/**
 * R3, which text an item prints: for each language, the first context in
 * `contextOrder` that holds a text in that language. The site's context comes
 * first, then the item's Project's context, then the Default Context; a null
 * entry (an item with no Project) is skipped. Returns the chosen text per
 * language, each still carrying its `context_id`, so the package records
 * where the text came from.
 */
export function pickTexts<T extends { language_id: string; context_id: string }>(
  texts: T[],
  contextOrder: (string | null)[]
): Map<string, T> {
  const order = contextOrder.filter((id): id is string => id !== null)
  const out = new Map<string, T>()
  for (const contextId of order) {
    for (const text of texts) {
      if (text.context_id === contextId && !out.has(text.language_id)) out.set(text.language_id, text)
    }
  }
  return new Map([...out.entries()].sort(([a], [b]) => a.localeCompare(b)))
}

/**
 * Groups rows by a key, keeping their order: the shape every per-record
 * list in the package is built from.
 */
export function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const row of rows) {
    const k = key(row)
    const list = out.get(k)
    if (list) list.push(row)
    else out.set(k, [row])
  }
  return out
}

/** A copy of `row` without the keys whose value is null, undefined or an empty string. */
export function compact<T extends Record<string, unknown>>(row: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(row).filter(([, value]) => value !== null && value !== undefined && value !== '')
  ) as Partial<T>
}

/** Numbers stored as strings by the driver (DECIMAL) come back as numbers; null stays null. */
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

// @ts-check
/**
 * Drafts (M17 B3, inventory-app#2746): a record not ready for any site.
 *
 * - `items.draft`: a draft item ships nowhere, and neither do its details and
 *   pictures (its descendants by `items.parent_id`). No reference to it ships
 *   either: not as a member, a related or see-also link, a cover, a banner,
 *   a homepage or monument item, in dynasty images, partner lists, timelines,
 *   tag counts or the glossary.
 * - `item_translations.draft`: a draft text doesn't ship; the item still
 *   ships with its other texts.
 * - `collections.draft`: a draft collection and every collection under it
 *   (by `parent_id`, any depth) ship nowhere. Sharing History keeps shipping
 *   a draft exhibition with `published: false` (its legacy behaviour).
 *
 * `itemShipped`, `itemIdShipped` and `textShipped` are SQL conditions for the
 * queries that pick what ships; `loadDraftCollectionIds` and `loadDraftItemIds` give the drafts
 * to leave out of what a query can't filter. `assertNoDraftItems` is the
 * guard: an export fails if a draft item's id appears in any file it wrote.
 *
 * Types are in `drafts.d.mts`.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** How many hits the guard names before it stops looking. */
const MAX_HITS = 20

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/** @param {unknown} value */
const isDraft = value => value === true || Number(value) === 1

/** @param {string} alias */
const subAlias = alias => alias.replace(/[^A-Za-z0-9_]/g, '_')

/**
 * The SQL condition that the item row `alias` ships: it is not a draft and
 * has no draft ancestor. The item hierarchy is at most three levels deep
 * (an object or monument, its details, their pictures), so checking the
 * parent and the grandparent is enough. The subquery aliases derive from
 * `alias`, so two uses in one query don't collide.
 *
 * @param {string} alias the items alias (or table name) in the query
 * @returns {string}
 */
export function itemShipped(alias) {
  const p = `dr_p_${subAlias(alias)}`
  const g = `dr_g_${subAlias(alias)}`
  return (
    `(${alias}.draft = 0 AND NOT EXISTS (SELECT 1 FROM items ${p} WHERE ${p}.id = ${alias}.parent_id` +
    ` AND (${p}.draft = 1 OR EXISTS (SELECT 1 FROM items ${g} WHERE ${g}.id = ${p}.parent_id AND ${g}.draft = 1))))`
  )
}

/**
 * The SQL condition that the item id in `column` (a reference: a link's
 * target, a cover, a monument item) may ship: it is null, unknown, or an item
 * that ships. For a column written as it is, `CASE WHEN <this> THEN column END`
 * nulls a draft's id and leaves every other value unchanged.
 *
 * @param {string} column the column holding the item id, e.g. `p.monument_item_id`
 * @param {string} alias a fresh items alias for the subquery
 * @returns {string}
 */
export function itemIdShipped(column, alias) {
  return `NOT EXISTS (SELECT 1 FROM items ${alias} WHERE ${alias}.id = ${column} AND NOT ${itemShipped(alias)})`
}

/**
 * The SQL condition that the item_translations row `alias` ships: it is not
 * a draft.
 *
 * @param {string} alias the item_translations alias (or table name) in the query
 * @returns {string}
 */
export function textShipped(alias) {
  return `${alias}.draft = 0`
}

/**
 * The ids of the rows that are drafts, with every row under them.
 *
 * @param {{ id: string, parent_id: string | null, draft: unknown }[]} rows
 * @returns {Set<string>}
 */
function withDescendants(rows) {
  /** @type {Map<string, string[]>} */
  const children = new Map()
  for (const row of rows) {
    if (!row.parent_id) continue
    const list = children.get(row.parent_id)
    if (list) list.push(row.id)
    else children.set(row.parent_id, [row.id])
  }
  /** @type {Set<string>} */
  const out = new Set()
  const queue = rows.filter(row => isDraft(row.draft)).map(row => row.id)
  while (queue.length > 0) {
    const id = /** @type {string} */ (queue.pop())
    if (out.has(id)) continue
    out.add(id)
    queue.push(...(children.get(id) ?? []))
  }
  return out
}

/**
 * Every draft collection and every collection under it, any depth.
 *
 * @param {import('./sites.mjs').Query} query
 * @returns {Promise<Set<string>>}
 */
export async function loadDraftCollectionIds(query) {
  const rows = /** @type {{ id: string, parent_id: string | null, draft: unknown }[]} */ (
    await query('SELECT id, parent_id, draft FROM collections ORDER BY id')
  )
  return withDescendants(rows)
}

/**
 * Every draft item and every item under it (its details and pictures).
 * With no draft at all (the usual case), the hierarchy isn't read.
 *
 * @param {import('./sites.mjs').Query} query
 * @returns {Promise<Set<string>>}
 */
export async function loadDraftItemIds(query) {
  const drafts = /** @type {{ id: string }[]} */ (await query('SELECT id FROM items WHERE draft = 1 ORDER BY id'))
  if (drafts.length === 0) return new Set()
  const rows = /** @type {{ id: string, parent_id: string | null, draft: unknown }[]} */ (
    await query('SELECT id, parent_id, draft FROM items ORDER BY id')
  )
  return withDescendants(rows)
}

/**
 * Every file under `dir`, any depth.
 *
 * @param {string} dir
 * @returns {string[]}
 */
function filesUnder(dir) {
  /** @type {string[]} */
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...filesUnder(path))
    else if (entry.isFile()) out.push(path)
  }
  return out.sort()
}

/**
 * The guard: fails when a draft item's id appears in any file under
 * `outputDir`, naming each file and the id it holds (the first 20 hits).
 * With no draft item, it returns without reading a file.
 *
 * @param {import('./sites.mjs').Query} query
 * @param {string} outputDir
 * @returns {Promise<void>}
 */
export async function assertNoDraftItems(query, outputDir) {
  const drafts = await loadDraftItemIds(query)
  if (drafts.size === 0) return
  /** @type {string[]} */
  const hits = []
  for (const file of filesUnder(outputDir)) {
    const found = new Set()
    for (const match of readFileSync(file, 'utf8').matchAll(UUID)) {
      const id = match[0].toLowerCase()
      if (drafts.has(id) && !found.has(id)) {
        found.add(id)
        hits.push(`${file}: ${id}`)
        if (hits.length >= MAX_HITS) break
      }
    }
    if (hits.length >= MAX_HITS) break
  }
  if (hits.length > 0) {
    const more = hits.length >= MAX_HITS ? `\n  (stopped after ${MAX_HITS})` : ''
    throw new Error(`A draft item's id appears in the export:\n  ${hits.join('\n  ')}${more}`)
  }
}

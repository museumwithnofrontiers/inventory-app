// @ts-check
/**
 * Collection flags (M16 E4a, inventory-app#2650; M17 A1, inventory-app#2742):
 * a collection legacy hides is a draft (`collections.draft`). The packages
 * still ship legacy's encoding of that flag in `extra`, so an exporter puts it
 * back where it was:
 *
 * - `legacy_exhibition.show` (`n` for a draft, else `y`), into a
 *   translation's `legacy_exhibition`;
 * - `legacy_status` (`i` for a draft, else `e`) on an Explore theme's English
 *   text in its own context.
 *
 * A gallery's `thg_gallery.featured` and `thg_gallery.live_date` are site
 * configuration (M17 A2, inventory-app#2743): the instance files give them
 * back, with the rest of `thg_gallery` (`site-configuration.mjs`).
 *
 * A key the translation still holds (one the importer left, reported) is left
 * as it is.
 *
 * Types are in `collection-flags.d.mts`.
 */

import { mysqlJsonOrder } from './credits.mjs'

const THEME_KEY_PREFIX = 'mwnf3_explore:thematiccycle:'

const CHUNK = 500

/** @param {unknown[]} values */
const marks = values => values.map(() => '?').join(', ')

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)

/**
 * @typedef {{
 *   draft: boolean,
 *   contextId: string | null,
 *   backwardCompatibility: string | null,
 * }} CollectionFlags
 */

/**
 * The flags of these collections, by collection id.
 *
 * @param {import('./sites.mjs').Query} query
 * @param {string[]} collectionIds
 * @returns {Promise<Map<string, CollectionFlags>>}
 */
export async function loadCollectionFlags(query, collectionIds) {
  /** @type {Map<string, CollectionFlags>} */
  const out = new Map()
  const unique = [...new Set(collectionIds)]
  for (let start = 0; start < unique.length; start += CHUNK) {
    const ids = unique.slice(start, start + CHUNK)
    const rows = /** @type {{ id: string, draft: number | boolean, context_id: string | null, backward_compatibility: string | null }[]} */ (
      await query(
        `SELECT id, draft, context_id, backward_compatibility
         FROM collections
         WHERE id IN (${marks(ids)})
         ORDER BY id`,
        ids
      )
    )
    for (const row of rows) {
      out.set(row.id, {
        draft: Boolean(Number(row.draft)),
        contextId: row.context_id ?? null,
        backwardCompatibility: row.backward_compatibility ?? null,
      })
    }
  }
  return out
}

/**
 * A translation's `extra` with the collection's flags back where the
 * importer took them from, in MySQL's JSON key order. With nothing to put
 * back, `extra` is returned as it came.
 *
 * @param {unknown} extra the translation's `extra`: a JSON string, an object or null
 * @param {CollectionFlags | undefined} flags
 * @param {{ language_id?: string, context_id?: string }} [translation] needed for an Explore theme's status
 * @returns {unknown}
 */
export function withCollectionFlags(extra, flags, translation) {
  if (!flags) return extra
  const parsed = typeof extra === 'string' ? JSON.parse(extra) : extra
  const base = isObject(parsed) ? parsed : null
  /** @type {Record<string, unknown>} */
  const changed = {}

  const exhibition = base?.['legacy_exhibition']
  if (isObject(exhibition) && !('show' in exhibition)) {
    changed['legacy_exhibition'] = mysqlJsonOrder({ ...exhibition, show: flags.draft ? 'n' : 'y' })
  }
  const isTheme = (flags.backwardCompatibility ?? '').startsWith(THEME_KEY_PREFIX)
  if (
    isTheme &&
    translation?.language_id === 'eng' &&
    translation.context_id === flags.contextId &&
    !(base && 'legacy_status' in base)
  ) {
    changed['legacy_status'] = flags.draft ? 'i' : 'e'
  }

  if (Object.keys(changed).length === 0) return extra
  return mysqlJsonOrder({ ...(base ?? {}), ...changed })
}

/**
 * Loads the flags of the rows' collections and puts them back into each
 * row's `extra`. The rows are changed in place and returned.
 *
 * @template {{ collection_id: string, extra?: unknown, language_id?: string, context_id?: string }} T
 * @param {import('./sites.mjs').Query} query
 * @param {T[]} rows
 * @returns {Promise<T[]>}
 */
export async function restoreCollectionFlags(query, rows) {
  const flags = await loadCollectionFlags(query, rows.map(row => row.collection_id))
  for (const row of rows) row.extra = withCollectionFlags(row.extra, flags.get(row.collection_id), row)
  return rows
}

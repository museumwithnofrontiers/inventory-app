// @ts-check
/**
 * Collection flags (M16 E4a, inventory-app#2650, decision 6): the editorial
 * flags that left `collection_translations.extra` for `collections.visible`,
 * `featured` and `published_at` (`scripts/importer/src/utils/collection-flags.ts`).
 * The packages still ship them in `extra`, so an exporter puts each back,
 * where it was:
 *
 * - `legacy_exhibition.show` (`y`/`n` from `visible`), into a translation's
 *   `legacy_exhibition`;
 * - `thg_gallery.featured` (`A`/`H`, legacy's enum) and `thg_gallery.live_date`
 *   (the date at midnight UTC, as the importer stored it), into a
 *   translation's `thg_gallery`;
 * - `legacy_status` (`e`/`i` from `visible`) on an Explore theme's English
 *   text in its own context.
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
 *   visible: boolean,
 *   featured: boolean,
 *   publishedAt: string | null,
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
    const rows = /** @type {{ id: string, visible: number | boolean, featured: number | boolean, published_at: string | null, context_id: string | null, backward_compatibility: string | null }[]} */ (
      await query(
        `SELECT id, visible, featured, DATE_FORMAT(published_at, '%Y-%m-%d') AS published_at,
                context_id, backward_compatibility
         FROM collections
         WHERE id IN (${marks(ids)})
         ORDER BY id`,
        ids
      )
    )
    for (const row of rows) {
      out.set(row.id, {
        visible: Boolean(Number(row.visible)),
        featured: Boolean(Number(row.featured)),
        publishedAt: row.published_at ?? null,
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
    changed['legacy_exhibition'] = mysqlJsonOrder({ ...exhibition, show: flags.visible ? 'y' : 'n' })
  }
  const gallery = base?.['thg_gallery']
  if (isObject(gallery)) {
    const restored = { ...gallery }
    if (!('featured' in gallery)) restored['featured'] = flags.featured ? 'A' : 'H'
    if (!('live_date' in gallery) && flags.publishedAt) restored['live_date'] = `${flags.publishedAt}T00:00:00.000Z`
    if (Object.keys(restored).length !== Object.keys(gallery).length) changed['thg_gallery'] = mysqlJsonOrder(restored)
  }
  const isTheme = (flags.backwardCompatibility ?? '').startsWith(THEME_KEY_PREFIX)
  if (
    isTheme &&
    translation?.language_id === 'eng' &&
    translation.context_id === flags.contextId &&
    !(base && 'legacy_status' in base)
  ) {
    changed['legacy_status'] = flags.visible ? 'e' : 'i'
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

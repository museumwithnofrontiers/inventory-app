// @ts-check
/**
 * Placement translations (M16 C2, inventory-app#2642; ADR 006): a placement's
 * texts per language, which left `collection_item.extra` for
 * `collection_item_translations`. The importer moves each key to its column
 * (`scripts/importer/src/utils/collection-item-translations.ts`, keep the two
 * in step); the packages still ship each text under its legacy key in the
 * placement's `extra`, so an exporter selects the translations with
 * `placementTranslationsSelect` and puts the keys back with
 * `restorePlacementTranslations` before reading `extra`.
 *
 * - `title` → `detail_name`; `caption` → `image_captions`;
 *   `item_name`, `item_date`, `item_location`, `item_museum`, `item_dynasty`,
 *   `item_artist`, `item_material` → the same keys (C3, inventory-app#2643);
 *   `backward_compatibility` → `source_bc_by_language`.
 * - `description` → `detail_justification` on an mwnf3 collection (legacy key
 *   `mwnf3:…`), else `contextual_descriptions`.
 * - `justifications`: `justification` as the language's text, else
 *   `{ curator, partner }` when either is set.
 *
 * Each map is in the key order MySQL gives a JSON object.
 *
 * Types are in `placement-translations.d.mts`.
 */

import { mysqlJsonOrder } from './credits.mjs'

/** The translations, selected as one JSON list under this name. */
const TEXTS = 'placement_translations'
/** The placement's collection's legacy key, selected under this name. */
const SOURCE = 'placement_collection_source'

/** Legacy key prefixes of the collections whose description is `detail_justification`. */
const DETAIL_JUSTIFICATION_SOURCES = Object.freeze(['mwnf3:'])

/** Each column that holds one text per language, and its legacy key. */
const TEXT_KEYS = Object.freeze([
  Object.freeze({ column: 'title', key: 'detail_name' }),
  Object.freeze({ column: 'caption', key: 'image_captions' }),
  Object.freeze({ column: 'item_name', key: 'item_name' }),
  Object.freeze({ column: 'item_date', key: 'item_date' }),
  Object.freeze({ column: 'item_location', key: 'item_location' }),
  Object.freeze({ column: 'item_museum', key: 'item_museum' }),
  Object.freeze({ column: 'item_dynasty', key: 'item_dynasty' }),
  Object.freeze({ column: 'item_artist', key: 'item_artist' }),
  Object.freeze({ column: 'item_material', key: 'item_material' }),
  Object.freeze({ column: 'backward_compatibility', key: 'source_bc_by_language' }),
])

const COLUMNS = [
  'title',
  'description',
  'curator_justification',
  'partner_justification',
  'justification',
  'caption',
  'item_name',
  'item_date',
  'item_location',
  'item_museum',
  'item_dynasty',
  'item_artist',
  'item_material',
  'backward_compatibility',
]

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)

/**
 * The translations and the collection's legacy key, for a SELECT list.
 *
 * @param {string} alias the collection_item alias (or table name) in the query
 * @returns {string}
 */
export function placementTranslationsSelect(alias) {
  const fields = COLUMNS.map(column => `'${column}', pt_t.${column}`).join(', ')
  return (
    `(SELECT JSON_ARRAYAGG(JSON_OBJECT('lang', pt_t.language_id, ${fields}))` +
    ` FROM collection_item_translations pt_t WHERE pt_t.collection_item_id = ${alias}.id) AS ${TEXTS}, ` +
    `(SELECT pt_c.backward_compatibility FROM collections pt_c WHERE pt_c.id = ${alias}.collection_id) AS ${SOURCE}`
  )
}

/**
 * The key a placement's description goes back under.
 *
 * @param {unknown} source the collection's legacy key
 * @returns {string}
 */
export function descriptionKey(source) {
  const key = typeof source === 'string' ? source : ''
  return DETAIL_JUSTIFICATION_SOURCES.some(prefix => key.startsWith(prefix)) ? 'detail_justification' : 'contextual_descriptions'
}

/**
 * The legacy keys the translations held, each a map of language to text.
 *
 * @param {unknown} value the selected JSON list (a string, a list or null)
 * @param {unknown} source the collection's legacy key
 * @returns {Record<string, unknown>}
 */
export function placementTextKeys(value, source) {
  const list = typeof value === 'string' ? JSON.parse(value) : value
  if (!Array.isArray(list)) return {}
  /** @type {Record<string, Record<string, unknown>>} */
  const maps = {}
  /** @param {string} key @param {string} lang @param {unknown} text */
  const put = (key, lang, text) => {
    maps[key] = { ...(maps[key] ?? {}), [lang]: text }
  }
  const description = descriptionKey(source)
  for (const text of list) {
    if (!isObject(text) || typeof text.lang !== 'string') continue
    for (const { column, key } of TEXT_KEYS) {
      if (typeof text[column] === 'string') put(key, text.lang, text[column])
    }
    if (typeof text.description === 'string') put(description, text.lang, text.description)
    if (typeof text.justification === 'string') {
      put('justifications', text.lang, text.justification)
    } else if (text.curator_justification != null || text.partner_justification != null) {
      put('justifications', text.lang, {
        curator: text.curator_justification ?? null,
        partner: text.partner_justification ?? null,
      })
    }
  }
  return Object.fromEntries(Object.entries(maps).map(([key, byLanguage]) => [key, mysqlJsonOrder(byLanguage)]))
}

/**
 * The placement's `extra` with its translations back under their legacy keys,
 * in the key order MySQL gives a JSON object. With no translation, `extra` is
 * returned as it came (null stays null).
 *
 * @param {unknown} extra the row's `extra`: a JSON string, an object or null
 * @param {Record<string, unknown>} row the row, holding the selected translations
 * @returns {unknown}
 */
export function withPlacementTranslations(extra, row) {
  const texts = placementTextKeys(row[TEXTS], row[SOURCE])
  if (Object.keys(texts).length === 0) return extra
  const parsed = typeof extra === 'string' ? JSON.parse(extra) : extra
  const base = isObject(parsed) ? parsed : {}
  return mysqlJsonOrder({ ...base, ...texts })
}

/**
 * Puts the translations of each row (selected with
 * `placementTranslationsSelect`) back into its `extra`, then removes them
 * from the row, so the rest of the exporter reads the row as before. The rows
 * are changed in place and returned.
 *
 * @template {{ extra?: unknown }} T
 * @param {T[]} rows
 * @returns {T[]}
 */
export function restorePlacementTranslations(rows) {
  for (const row of rows) {
    const record = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (row))
    record.extra = withPlacementTranslations(record.extra, record)
    delete record[TEXTS]
    delete record[SOURCE]
  }
  return rows
}

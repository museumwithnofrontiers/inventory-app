// @ts-check
/**
 * Collection translation columns (M16, ADR 006): the texts that left
 * `collection_translations.extra` for columns of their own. The importer moves
 * each key to its column
 * (`scripts/importer/src/utils/collection-translation-columns.ts`, keep the
 * two lists equal); the packages still ship each text under its legacy key in
 * `extra`, so an exporter selects the columns and puts the keys back before
 * reading `extra`.
 *
 * - E1 (inventory-app#2647): subtitle, introduction, duration. The
 *   introduction goes back as `intro_text` on a mwnf3 text (the name of
 *   mwnf3's exhibition field) and as `introduction` on any other (Travels'
 *   itineraries). The translation's legacy key says which, so
 *   `collectionColumnsSelect` selects it too.
 *
 * Types are in `collection-columns.d.mts`.
 */

import { mysqlJsonOrder } from './credits.mjs'

/** Each legacy `extra` key and the column that holds it now. */
export const COLLECTION_TRANSLATION_COLUMNS = Object.freeze([
  Object.freeze({ key: 'subtitle', column: 'subtitle' }),
  Object.freeze({ key: 'intro_text', column: 'introduction' }),
  Object.freeze({ key: 'introduction', column: 'introduction' }),
  Object.freeze({ key: 'duration', column: 'duration' }),
])

/** The translation's legacy key, selected next to the columns under this name. */
const SOURCE = 'collection_columns_source'

/** Legacy keys of the texts whose introduction was `intro_text`. */
const INTRO_TEXT_SOURCES = Object.freeze(['mwnf3:'])

const COLUMNS = [...new Set(COLLECTION_TRANSLATION_COLUMNS.map(({ column }) => column))]

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)

/**
 * The columns, for a SELECT list: `ct.subtitle, …, ct.backward_compatibility AS collection_columns_source`.
 *
 * @param {string} alias the collection_translations alias (or table name) in the query
 * @returns {string}
 */
export function collectionColumnsSelect(alias) {
  return [...COLUMNS.map(column => `${alias}.${column}`), `${alias}.backward_compatibility AS ${SOURCE}`].join(', ')
}

/**
 * The legacy key `introduction` goes back under for this row.
 *
 * @param {Record<string, unknown>} row
 * @returns {string}
 */
function introductionKey(row) {
  const source = typeof row[SOURCE] === 'string' ? /** @type {string} */ (row[SOURCE]) : ''
  return INTRO_TEXT_SOURCES.some(prefix => source.startsWith(prefix)) ? 'intro_text' : 'introduction'
}

/**
 * The translation's `extra` with each column that holds a text back under its
 * legacy key, in the key order MySQL gives a JSON object, so the package reads
 * as it did when the texts were stored there. With no such column set,
 * `extra` is returned as it came (null stays null).
 *
 * @param {unknown} extra the row's `extra`: a JSON string, an object or null
 * @param {Record<string, unknown>} row the row, holding the columns
 * @returns {unknown}
 */
export function withCollectionTranslationColumns(extra, row) {
  /** @type {Record<string, string>} */
  const texts = {}
  for (const { key, column } of COLLECTION_TRANSLATION_COLUMNS) {
    const value = row[column]
    if (typeof value !== 'string') continue
    if (column === 'introduction' && key !== introductionKey(row)) continue
    texts[key] = value
  }
  if (Object.keys(texts).length === 0) return extra
  const parsed = typeof extra === 'string' ? JSON.parse(extra) : extra
  const base = isObject(parsed) ? parsed : {}
  return mysqlJsonOrder({ ...base, ...texts })
}

/**
 * Puts the columns of each row (selected with `collectionColumnsSelect`) back
 * into its `extra`, then removes them from the row, so the rest of the
 * exporter reads the row as before. The rows are changed in place and
 * returned.
 *
 * @template {{ extra?: unknown }} T
 * @param {T[]} rows
 * @returns {T[]}
 */
export function restoreCollectionColumns(rows) {
  for (const row of rows) {
    const record = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (row))
    record.extra = withCollectionTranslationColumns(record.extra, record)
    for (const column of [...COLUMNS, SOURCE]) delete record[column]
  }
  return rows
}

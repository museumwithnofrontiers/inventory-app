// @ts-check
/**
 * Item translation columns (M16, ADR 006): the texts that left
 * `item_translations.extra` for columns of their own. The importer moves each
 * key to its column (`scripts/importer/src/utils/item-translation-columns.ts`,
 * keep the two lists equal); the packages still ship each text under its
 * legacy key in `extra`, so an exporter selects the columns and puts the keys
 * back before reading `extra`.
 *
 * - B1 (inventory-app#2635): materials, short description, dynasty, region,
 *   history.
 * - B4 (inventory-app#2638): the credits as written, in the four `*_credit`
 *   columns. On an Explore or Travels text `author_credit` goes back as
 *   `prepared_by`, the legacy field those texts had; on any other text the four
 *   go back inside `credits_as_written`. The translation's legacy key says
 *   which, so `itemColumnsSelect` selects it too.
 *
 * Types are in `item-columns.d.mts`.
 */

import { mysqlJsonOrder } from './credits.mjs'

/** Each legacy `extra` key (`key` or `parent.child`) and the column that holds it now. */
export const ITEM_TRANSLATION_COLUMNS = Object.freeze([
  Object.freeze({ key: 'materials', column: 'materials' }),
  Object.freeze({ key: 'description2', column: 'short_description' }),
  Object.freeze({ key: 'dynasty', column: 'dynasty' }),
  Object.freeze({ key: 'province', column: 'region' }),
  Object.freeze({ key: 'history', column: 'history' }),
  Object.freeze({ key: 'credits_as_written.author', column: 'author_credit' }),
  Object.freeze({ key: 'credits_as_written.copy_editor', column: 'copy_editor_credit' }),
  Object.freeze({ key: 'credits_as_written.translator', column: 'translator_credit' }),
  Object.freeze({ key: 'credits_as_written.translation_copy_editor', column: 'translation_copy_editor_credit' }),
  Object.freeze({ key: 'prepared_by', column: 'author_credit' }),
])

/** The translation's legacy key, selected next to the columns under this name. */
const SOURCE = 'item_columns_source'

/** Legacy keys of the texts whose author credit was `prepared_by`. */
const PREPARED_BY_SOURCES = Object.freeze(['mwnf3_explore:', 'mwnf3_travels:'])

const COLUMNS = [...new Set(ITEM_TRANSLATION_COLUMNS.map(({ column }) => column))]

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)

/**
 * The columns, for a SELECT list: `it.materials, …, it.backward_compatibility AS item_columns_source`.
 *
 * @param {string} alias the item_translations alias in the query
 * @returns {string}
 */
export function itemColumnsSelect(alias) {
  return [...COLUMNS.map(column => `${alias}.${column}`), `${alias}.backward_compatibility AS ${SOURCE}`].join(', ')
}

/**
 * The legacy key `author_credit` goes back under for this row.
 *
 * @param {Record<string, unknown>} row
 * @returns {string}
 */
function authorCreditKey(row) {
  const source = typeof row[SOURCE] === 'string' ? /** @type {string} */ (row[SOURCE]) : ''
  return PREPARED_BY_SOURCES.some(prefix => source.startsWith(prefix)) ? 'prepared_by' : 'credits_as_written.author'
}

/**
 * The translation's `extra` with each column that holds a text back under its
 * legacy key, in the key order MySQL gives a JSON object (an inner object
 * too), so the package reads as it did when the texts were stored there. With
 * no such column set, `extra` is returned as it came (null stays null).
 *
 * @param {unknown} extra the row's `extra`: a JSON string, an object or null
 * @param {Record<string, unknown>} row the row, holding the columns
 * @returns {unknown}
 */
export function withItemTranslationColumns(extra, row) {
  /** @type {Record<string, unknown>} */
  const texts = {}
  for (const { key, column } of ITEM_TRANSLATION_COLUMNS) {
    const value = row[column]
    if (typeof value !== 'string') continue
    if (column === 'author_credit' && key !== authorCreditKey(row)) continue
    const [parent, child] = key.split('.')
    if (child === undefined) texts[parent] = value
    else texts[parent] = { ...(isObject(texts[parent]) ? texts[parent] : {}), [child]: value }
  }
  if (Object.keys(texts).length === 0) return extra
  const parsed = typeof extra === 'string' ? JSON.parse(extra) : extra
  const base = isObject(parsed) ? parsed : {}
  /** @type {Record<string, unknown>} */
  const merged = { ...base }
  for (const [key, value] of Object.entries(texts)) {
    const inner = base[key]
    merged[key] = isObject(value) ? mysqlJsonOrder({ ...(isObject(inner) ? inner : {}), ...value }) : value
  }
  return mysqlJsonOrder(merged)
}

/**
 * Puts the columns of each row (selected with `itemColumnsSelect`) back into
 * its `extra`, then removes them from the row, so the rest of the exporter
 * reads the row as before. The rows are changed in place and returned.
 *
 * @template {{ extra?: unknown }} T
 * @param {T[]} rows
 * @returns {T[]}
 */
export function restoreItemColumns(rows) {
  for (const row of rows) {
    const record = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (row))
    record.extra = withItemTranslationColumns(record.extra, record)
    for (const column of [...COLUMNS, SOURCE]) delete record[column]
  }
  return rows
}

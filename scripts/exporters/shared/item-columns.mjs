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
 *
 * Types are in `item-columns.d.mts`.
 */

import { mysqlJsonOrder } from './credits.mjs'

/** Each legacy `extra` key and the column that holds it now. */
export const ITEM_TRANSLATION_COLUMNS = Object.freeze([
  Object.freeze({ key: 'materials', column: 'materials' }),
  Object.freeze({ key: 'description2', column: 'short_description' }),
  Object.freeze({ key: 'dynasty', column: 'dynasty' }),
  Object.freeze({ key: 'province', column: 'region' }),
  Object.freeze({ key: 'history', column: 'history' }),
])

/**
 * The columns, for a SELECT list: `it.materials, it.short_description, …`.
 *
 * @param {string} alias the item_translations alias in the query
 * @returns {string}
 */
export function itemColumnsSelect(alias) {
  return ITEM_TRANSLATION_COLUMNS.map(({ column }) => `${alias}.${column}`).join(', ')
}

/**
 * The translation's `extra` with each column that holds a text back under its
 * legacy key, in the key order MySQL gives a JSON object, so the package reads
 * as it did when the texts were stored there. With no such column set, `extra`
 * is returned as it came (null stays null).
 *
 * @param {unknown} extra the row's `extra`: a JSON string, an object or null
 * @param {Record<string, unknown>} row the row, holding the columns
 * @returns {unknown}
 */
export function withItemTranslationColumns(extra, row) {
  /** @type {Record<string, string>} */
  const texts = {}
  for (const { key, column } of ITEM_TRANSLATION_COLUMNS) {
    const value = row[column]
    if (typeof value === 'string') texts[key] = value
  }
  if (Object.keys(texts).length === 0) return extra
  const parsed = typeof extra === 'string' ? JSON.parse(extra) : extra
  const base = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? /** @type {Record<string, unknown>} */ (parsed) : {}
  return mysqlJsonOrder({ ...base, ...texts })
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
    for (const { column } of ITEM_TRANSLATION_COLUMNS) delete record[column]
  }
  return rows
}

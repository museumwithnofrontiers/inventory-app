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
 * - F2 (inventory-app#2652): `cover_images` from `cover_caption`; and the
 *   history pages' `image_captions` and the profiles' `map_descriptions`,
 *   rebuilt from the ImageTranslations of the collection's images.
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
  Object.freeze({ key: 'cover_images', column: 'cover_caption' }),
])

/** The translation's legacy key, selected next to the columns under this name. */
const SOURCE = 'collection_columns_source'

/** Legacy keys of the texts whose introduction was `intro_text`. */
const INTRO_TEXT_SOURCES = Object.freeze(['mwnf3:'])

const COLUMNS = [...new Set(COLLECTION_TRANSLATION_COLUMNS.map(({ column }) => column))]

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
/** The collection's image texts (F2), selected as one JSON list under this name. */
const IMAGE_TEXTS = 'collection_columns_image_texts'
const HB_IMAGE_PREFIX = 'mwnf3_sharing_history:sh_countries_historicalbackground_images:'
const HB_MAP_PREFIX = 'mwnf3_sharing_history:sh_countries_historicalbackground_maps:'

/**
 * @param {string} alias
 * @returns {string}
 */
function imageTextsSelect(alias) {
  return (
    "(SELECT JSON_ARRAYAGG(JSON_OBJECT('key', cc_it.backward_compatibility, 'lang', cc_it.language_id," +
    " 'caption', cc_it.caption, 'name', cc_it.name, 'date', cc_it.date, 'museum', cc_it.museum, 'location', cc_it.location))" +
    " FROM image_translations cc_it JOIN collection_images cc_ci ON cc_it.image_type = 'collection_image' AND cc_it.image_id = cc_ci.id" +
    ` WHERE cc_ci.collection_id = ${alias}.collection_id` +
    " AND cc_it.backward_compatibility LIKE 'mwnf3_sharing_history:sh_countries_historicalbackground_%')" +
    ` AS ${IMAGE_TEXTS}`
  )
}

/**
 * `image_captions` and `map_descriptions` as the history-page importer wrote
 * them, rebuilt from the collection's image texts, each object in MySQL's key
 * order; a caption carries only the fields it had.
 *
 * @param {unknown} value the selected JSON list (a string, a list or null)
 * @returns {Record<string, unknown>}
 */
function imageTextKeys(value) {
  const list = typeof value === 'string' ? JSON.parse(value) : value
  if (!Array.isArray(list)) return {}
  /** @type {Record<string, Record<string, unknown>>} */
  const captions = {}
  /** @type {Record<string, Record<string, unknown>>} */
  const maps = {}
  for (const text of list) {
    if (!isObject(text) || typeof text.key !== 'string' || typeof text.lang !== 'string') continue
    if (text.key.startsWith(HB_IMAGE_PREFIX)) {
      /** @type {Record<string, unknown>} */
      const fields = {}
      for (const field of ['name', 'date', 'museum', 'location']) if (typeof text[field] === 'string') fields[field] = text[field]
      captions[text.key] = { ...(captions[text.key] ?? {}), [text.lang]: mysqlJsonOrder(fields) }
    } else if (text.key.startsWith(HB_MAP_PREFIX) && typeof text.caption === 'string') {
      const mapKey = `map_${text.key.slice(HB_MAP_PREFIX.length)}`
      maps[mapKey] = { ...(maps[mapKey] ?? {}), [text.lang]: text.caption }
    }
  }
  /** @type {Record<string, unknown>} */
  const out = {}
  /** @param {Record<string, Record<string, unknown>>} byKey */
  const ordered = byKey => mysqlJsonOrder(Object.fromEntries(Object.entries(byKey).map(([k, v]) => [k, mysqlJsonOrder(v)])))
  if (Object.keys(captions).length > 0) out.image_captions = ordered(captions)
  if (Object.keys(maps).length > 0) out.map_descriptions = ordered(maps)
  return out
}

/**
 * The columns, for a SELECT list: `ct.subtitle, …, ct.backward_compatibility AS collection_columns_source`.
 *
 * @param {string} alias the collection_translations alias (or table name) in the query
 * @returns {string}
 */
export function collectionColumnsSelect(alias) {
  return [
    ...COLUMNS.map(column => `${alias}.${column}`),
    `${alias}.backward_compatibility AS ${SOURCE}`,
    imageTextsSelect(alias),
  ].join(', ')
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
  /** @type {Record<string, unknown>} */
  const texts = {}
  for (const { key, column } of COLLECTION_TRANSLATION_COLUMNS) {
    const value = row[column]
    if (typeof value !== 'string') continue
    if (column === 'introduction' && key !== introductionKey(row)) continue
    texts[key] = value
  }
  Object.assign(texts, imageTextKeys(row[IMAGE_TEXTS]))
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
    for (const column of [...COLUMNS, SOURCE, IMAGE_TEXTS]) delete record[column]
  }
  return rows
}

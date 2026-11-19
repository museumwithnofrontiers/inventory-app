// @ts-check
/**
 * Explore's monuments on placements (M16 C4, inventory-app#2644; ADR 006):
 * the rows of `collection_item_explore_monuments`, which left
 * `collection_item.extra`. The importer moves the keys
 * (`scripts/importer/src/utils/explore-monuments.ts`, keep the two in step);
 * the packages still ship them in the placement's `extra`, so an exporter
 * selects the rows with `exploreMonumentsSelect` and puts the keys back with
 * `restoreExploreMonuments` before reading `extra`.
 *
 * - On an Explore location (`mwnf3_explore:location:…`): `explore_monument_ids`
 *   (in position order), `explore_geo` and `explore_museums`, keyed by id.
 * - On an itinerary (`mwnf3_explore:itinerary:…`): `explore_monument_id`,
 *   `location_id`, and `desc_types`, `tr_mn_desc`, `explore_mn_desc`,
 *   `vm_mn_desc` where set.
 *
 * Each object is in the key order MySQL gives a JSON object.
 *
 * Types are in `explore-monuments.d.mts`.
 */

import { mysqlJsonOrder } from './credits.mjs'

/** The rows, selected as one JSON list under this name. */
const ROWS = 'explore_monuments'
/** The placement's collection's legacy key, selected under this name. */
const SOURCE = 'explore_collection_source'

const LOCATION_PREFIX = 'mwnf3_explore:location:'
const ITINERARY_PREFIX = 'mwnf3_explore:itinerary:'
const MONUMENT_PREFIX = 'mwnf3_explore:monument:'

/** Each itinerary description reference column and its legacy key. */
const DESCRIPTION_REFERENCES = Object.freeze([
  Object.freeze({ column: 'description_types', key: 'desc_types' }),
  Object.freeze({ column: 'travels_description_ref', key: 'tr_mn_desc' }),
  Object.freeze({ column: 'explore_description_ref', key: 'explore_mn_desc' }),
  Object.freeze({ column: 'virtual_museum_description_ref', key: 'vm_mn_desc' }),
])

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)

/**
 * The rows and the collection's legacy key, for a SELECT list.
 *
 * @param {string} alias the collection_item alias (or table name) in the query
 * @returns {string}
 */
export function exploreMonumentsSelect(alias) {
  const references = DESCRIPTION_REFERENCES.map(({ column }) => `'${column}', em_m.${column}`).join(', ')
  return (
    "(SELECT JSON_ARRAYAGG(JSON_OBJECT('position', em_m.position, 'key', em_m.backward_compatibility," +
    " 'latitude', em_m.latitude, 'longitude', em_m.longitude, 'map_zoom', em_m.map_zoom," +
    ' \'location\', (SELECT em_l.backward_compatibility FROM collections em_l WHERE em_l.id = em_m.location_collection_id),' +
    ` ${references},` +
    " 'museums', (SELECT JSON_ARRAYAGG(JSON_OBJECT('order', em_mp.display_order, 'key', em_p.backward_compatibility))" +
    ' FROM collection_item_explore_monument_partner em_mp JOIN partners em_p ON em_p.id = em_mp.partner_id' +
    ' WHERE em_mp.collection_item_explore_monument_id = em_m.id)))' +
    ` FROM collection_item_explore_monuments em_m WHERE em_m.collection_item_id = ${alias}.id) AS ${ROWS}, ` +
    `(SELECT em_c.backward_compatibility FROM collections em_c WHERE em_c.id = ${alias}.collection_id) AS ${SOURCE}`
  )
}

/** @param {unknown} value @returns {unknown[]} */
function listOf(value) {
  const list = typeof value === 'string' ? JSON.parse(value) : value
  return Array.isArray(list) ? list : []
}

/** The number a legacy key ends with. @param {unknown} key */
function lastNumber(key) {
  return typeof key === 'string' ? Number(key.split(':').pop()) : NaN
}

/**
 * A row's museums, by their order, then their key.
 *
 * @param {unknown} value
 * @returns {string[]}
 */
function museumKeys(value) {
  return listOf(value)
    .filter(isObject)
    .filter(m => typeof m.key === 'string')
    .sort((a, b) => {
      const left = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER
      const right = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER
      return left - right || (String(a.key) < String(b.key) ? -1 : String(a.key) > String(b.key) ? 1 : 0)
    })
    .map(m => /** @type {string} */ (m.key))
}

/**
 * The legacy keys the rows held.
 *
 * @param {unknown} value the selected JSON list (a string, a list or null)
 * @param {unknown} source the collection's legacy key
 * @returns {Record<string, unknown>}
 */
export function exploreMonumentKeys(value, source) {
  const rows = listOf(value)
    .filter(isObject)
    .filter(row => typeof row.key === 'string' && row.key.startsWith(MONUMENT_PREFIX))
    .sort((a, b) => Number(a.position) - Number(b.position))
  if (rows.length === 0) return {}
  const collection = typeof source === 'string' ? source : ''

  if (collection.startsWith(ITINERARY_PREFIX)) {
    const row = rows[0]
    /** @type {Record<string, unknown>} */
    const keys = { explore_monument_id: lastNumber(row.key) }
    if (typeof row.location === 'string' && row.location.startsWith(LOCATION_PREFIX)) keys.location_id = lastNumber(row.location)
    for (const { column, key } of DESCRIPTION_REFERENCES) {
      if (typeof row[column] === 'string') keys[key] = row[column]
    }
    return keys
  }

  /** @type {Record<string, unknown>} */
  const keys = { explore_monument_ids: rows.map(row => lastNumber(row.key)) }
  /** @type {Record<string, unknown>} */
  const geo = {}
  /** @type {Record<string, unknown>} */
  const museums = {}
  for (const row of rows) {
    const id = String(lastNumber(row.key))
    if (typeof row.latitude === 'number' && typeof row.longitude === 'number' && typeof row.map_zoom === 'number') {
      geo[id] = mysqlJsonOrder({ latitude: row.latitude, longitude: row.longitude, map_zoom: row.map_zoom })
    }
    const partners = museumKeys(row.museums)
    if (partners.length > 0) museums[id] = partners
  }
  if (Object.keys(geo).length > 0) keys.explore_geo = mysqlJsonOrder(geo)
  if (Object.keys(museums).length > 0) keys.explore_museums = mysqlJsonOrder(museums)
  return keys
}

/**
 * The placement's `extra` with its Explore monuments back under their legacy
 * keys, in the key order MySQL gives a JSON object. With no row, `extra` is
 * returned as it came (null stays null).
 *
 * @param {unknown} extra the row's `extra`: a JSON string, an object or null
 * @param {Record<string, unknown>} row the row, holding the selected rows
 * @returns {unknown}
 */
export function withExploreMonuments(extra, row) {
  const keys = exploreMonumentKeys(row[ROWS], row[SOURCE])
  if (Object.keys(keys).length === 0) return extra
  const parsed = typeof extra === 'string' ? JSON.parse(extra) : extra
  const base = isObject(parsed) ? parsed : {}
  return mysqlJsonOrder({ ...base, ...keys })
}

/**
 * Puts the Explore monuments of each row (selected with
 * `exploreMonumentsSelect`) back into its `extra`, then removes them from the
 * row. The rows are changed in place and returned.
 *
 * @template {{ extra?: unknown }} T
 * @param {T[]} rows
 * @returns {T[]}
 */
export function restoreExploreMonuments(rows) {
  for (const row of rows) {
    const record = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (row))
    record.extra = withExploreMonuments(record.extra, record)
    delete record[ROWS]
    delete record[SOURCE]
  }
  return rows
}

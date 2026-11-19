// @ts-check
/**
 * Site configuration (M16 E4b, inventory-app#2673; decision 6): the legacy
 * settings of the sites — a gallery's host, slug and chrome, an exhibition's
 * list metadata and texts, Explore's home and itinerary records, the logos —
 * live in the instance files (`../instances/*.json`, each file's
 * `collections`), not in the inventory. The importer's `site-config` command
 * writes them there from legacy; an exporter reads them here and gives each
 * key back to the package where `extra` held it:
 *
 * - `extra`: keys of the collection's own `extra`;
 * - `translation_extra`: keys every text of the collection carries;
 * - `translations.<language id>`: keys of that language's text.
 *
 * One copy per collection: an entry two instance files hold fails the
 * export, naming both, so a copy can never sneak in.
 *
 * Types are in `site-configuration.d.mts`.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mysqlJsonOrder } from './credits.mjs'

const INSTANCES = join(dirname(fileURLToPath(import.meta.url)), '..', 'instances')

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)

/**
 * @typedef {{
 *   extra?: Record<string, unknown>,
 *   translation_extra?: Record<string, unknown>,
 *   translations?: Record<string, Record<string, unknown>>,
 * }} SiteRecord
 */

/** @type {Map<string, Map<string, SiteRecord>>} */
const cache = new Map()

/** @type {Map<string, SiteRecord> | null} */
let override = null

/**
 * Replaces the instance files' site configuration with these records (tests),
 * or restores it with null.
 *
 * @param {Map<string, SiteRecord> | null} records
 */
export function setSiteConfiguration(records) {
  override = records
}

/**
 * Every collection's site configuration, by uuid, from the instance files of
 * this directory (read once).
 *
 * @param {string} [directory]
 * @returns {Map<string, SiteRecord>}
 */
export function loadSiteConfiguration(directory = INSTANCES) {
  if (override && directory === INSTANCES) return override
  const cached = cache.get(directory)
  if (cached) return cached
  /** @type {Map<string, SiteRecord>} */
  const records = new Map()
  /** @type {Map<string, string>} */
  const owner = new Map()
  for (const name of readdirSync(directory).filter(file => file.endsWith('.json')).sort()) {
    const data = JSON.parse(readFileSync(join(directory, name), 'utf8'))
    const collections = isObject(data) ? data['collections'] : undefined
    if (!isObject(collections)) continue
    for (const [uuid, record] of Object.entries(collections)) {
      const first = owner.get(uuid)
      if (first) throw new Error(`Collection ${uuid} is in two instance files: ${first} and ${name}`)
      owner.set(uuid, name)
      records.set(uuid, /** @type {SiteRecord} */ (record))
    }
  }
  cache.set(directory, records)
  return records
}

/**
 * A collection's `extra` with its site configuration back, in MySQL's JSON
 * key order. Without any, `extra` is returned as it came.
 *
 * @param {unknown} extra the collection's `extra`: a JSON string, an object or null
 * @param {string} collectionId
 * @param {Map<string, SiteRecord>} [records]
 * @returns {unknown}
 */
export function withSiteCollectionExtra(extra, collectionId, records = loadSiteConfiguration()) {
  const keys = records.get(collectionId)?.extra
  if (!keys || Object.keys(keys).length === 0) return extra
  const parsed = typeof extra === 'string' ? JSON.parse(extra) : extra
  return mysqlJsonOrder({ ...(isObject(parsed) ? parsed : {}), ...keys })
}

/**
 * A collection text's `extra` with its site configuration back (the keys
 * every text carries, then its own language's), in MySQL's JSON key order.
 *
 * @param {unknown} extra the text's `extra`
 * @param {string} collectionId
 * @param {string | undefined} languageId
 * @param {Map<string, SiteRecord>} [records]
 * @returns {unknown}
 */
export function withSiteTranslationExtra(extra, collectionId, languageId, records = loadSiteConfiguration()) {
  const record = records.get(collectionId)
  if (!record) return extra
  const keys = {
    ...(record.translation_extra ?? {}),
    ...((languageId && record.translations?.[languageId]) || {}),
  }
  if (Object.keys(keys).length === 0) return extra
  const parsed = typeof extra === 'string' ? JSON.parse(extra) : extra
  return mysqlJsonOrder({ ...(isObject(parsed) ? parsed : {}), ...keys })
}

/**
 * Puts the site configuration back into each text row's `extra`. The rows are
 * changed in place and returned.
 *
 * @template {{ collection_id: string, language_id?: string, extra?: unknown }} T
 * @param {T[]} rows
 * @returns {T[]}
 */
export function restoreSiteTranslations(rows) {
  for (const row of rows) row.extra = withSiteTranslationExtra(row.extra, row.collection_id, row.language_id)
  return rows
}

/**
 * Puts the site configuration back into each collection row's `extra`. The
 * rows are changed in place and returned.
 *
 * @template {{ id: string, extra?: unknown }} T
 * @param {T[]} rows
 * @returns {T[]}
 */
export function restoreSiteCollections(rows) {
  for (const row of rows) row.extra = withSiteCollectionExtra(row.extra, row.id)
  return rows
}

/**
 * The legacy mwnf3 project of a thematic gallery (`thg_gallery.mwnf3_project_id`),
 * from its site configuration.
 *
 * @param {string} collectionId
 * @returns {string | null}
 */
export function galleryProjectCode(collectionId) {
  const gallery = loadSiteConfiguration().get(collectionId)?.extra?.['thg_gallery']
  const code = isObject(gallery) ? gallery['mwnf3_project_id'] : null
  return typeof code === 'string' && code !== '' ? code : null
}

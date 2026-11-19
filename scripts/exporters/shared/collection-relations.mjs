// @ts-check
/**
 * Collection relations (M16 E3, inventory-app#2649; ADR 006): the legacy id
 * lists that left `extra` for the model. The importer resolved each id by its
 * legacy key (`scripts/importer/src/utils/collection-relations.ts`, keep the
 * lists equal); the packages still ship the lists in `extra`, so an exporter
 * loads the relations and puts the keys back before reading `extra`:
 *
 * - on the collection's English translation in its own context, where the
 *   Explore importers wrote them: `country_ids` (legacy country codes, from
 *   `collection_country`), `location_ids`, `territory_ids`, `theme_ids`,
 *   `additional_regions` (legacy ids, from the linked collection's legacy key);
 * - on the collection: `historical_background` (the linked collections'
 *   legacy keys), `thg_theme.cover_picture` (from `cover_item_id`), `days`.
 *
 * A link the legacy lists can't hold (a collection with another legacy key)
 * fails the export, naming the collection.
 *
 * Types are in `collection-relations.d.mts`.
 */

import { mysqlJsonOrder } from './credits.mjs'
import { legacyCountryCode } from './country-codes.mjs'

/** Each translation key, its link kind and the legacy key its ids sit under. */
export const TRANSLATION_LINK_KEYS = Object.freeze([
  Object.freeze({ key: 'location_ids', kind: 'location', prefix: 'mwnf3_explore:location:' }),
  Object.freeze({ key: 'territory_ids', kind: 'territory', prefix: 'mwnf3_explore:region:' }),
  Object.freeze({ key: 'theme_ids', kind: 'theme', prefix: 'mwnf3_explore:thematiccycle:' }),
  Object.freeze({ key: 'additional_regions', kind: 'additional_region', prefix: 'mwnf3_explore:region:' }),
])

const CHUNK = 500

/** @param {unknown[]} values */
const marks = values => values.map(() => '?').join(', ')

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)

/**
 * @typedef {{
 *   contextId: string | null,
 *   countries: string[],
 *   links: Record<string, string[]>,
 *   cover: { item_id: string, backward_compatibility: string | null } | null,
 *   days: number | null,
 * }} CollectionRelations
 */

/**
 * The relations of these collections, by collection id. A collection with
 * none is left out.
 *
 * @param {import('./sites.mjs').Query} query
 * @param {string[]} collectionIds
 * @returns {Promise<Map<string, CollectionRelations>>}
 */
export async function loadCollectionRelations(query, collectionIds) {
  /** @type {Map<string, CollectionRelations>} */
  const out = new Map()
  /** @type {Map<string, string | null>} */
  const contexts = new Map()
  /** @param {string} id */
  const entry = id => {
    let relations = out.get(id)
    if (!relations) {
      relations = { contextId: contexts.get(id) ?? null, countries: [], links: {}, cover: null, days: null }
      out.set(id, relations)
    }
    return relations
  }
  const unique = [...new Set(collectionIds)]
  for (let start = 0; start < unique.length; start += CHUNK) {
    const ids = unique.slice(start, start + CHUNK)
    const collections = /** @type {{ id: string, context_id: string | null, cover_item_id: string | null, cover_backward_compatibility: string | null, days: number | null }[]} */ (
      await query(
        `SELECT c.id, c.context_id, c.cover_item_id, i.backward_compatibility AS cover_backward_compatibility, c.days
         FROM collections c
         LEFT JOIN items i ON i.id = c.cover_item_id
         WHERE c.id IN (${marks(ids)})
         ORDER BY c.id`,
        ids
      )
    )
    for (const c of collections) contexts.set(c.id, c.context_id)
    for (const c of collections) {
      if (c.cover_item_id !== null) {
        entry(c.id).cover = { item_id: c.cover_item_id, backward_compatibility: c.cover_backward_compatibility }
      }
      if (c.days !== null) entry(c.id).days = c.days
    }
    const countries = /** @type {{ collection_id: string, country_id: string }[]} */ (
      await query(
        `SELECT collection_id, country_id FROM collection_country
         WHERE collection_id IN (${marks(ids)})
         ORDER BY collection_id, display_order, country_id`,
        ids
      )
    )
    for (const row of countries) entry(row.collection_id).countries.push(row.country_id)
    const links = /** @type {{ collection_id: string, kind: string, related_collection_id: string, backward_compatibility: string | null }[]} */ (
      await query(
        `SELECT cc.collection_id, cc.kind, cc.related_collection_id, rc.backward_compatibility
         FROM collection_collection cc
         JOIN collections rc ON rc.id = cc.related_collection_id
         WHERE cc.collection_id IN (${marks(ids)})
         ORDER BY cc.collection_id, cc.kind, cc.display_order, cc.related_collection_id`,
        ids
      )
    )
    for (const row of links) {
      if (!row.backward_compatibility) {
        throw new Error(`Collection ${row.collection_id}: its ${row.kind} link to ${row.related_collection_id} has no legacy key`)
      }
      const relations = entry(row.collection_id)
      ;(relations.links[row.kind] ??= []).push(row.backward_compatibility)
    }
  }
  return out
}

/**
 * The legacy id of a linked collection's legacy key.
 *
 * @param {string} key
 * @param {string} prefix
 * @param {string} collectionId the linking collection, for the error
 * @returns {number}
 */
function legacyId(key, prefix, collectionId) {
  const id = key.startsWith(prefix) ? Number(key.slice(prefix.length)) : Number.NaN
  if (!Number.isInteger(id)) {
    throw new Error(`Collection ${collectionId}: link ${key} is not a ${prefix}* collection`)
  }
  return id
}

/**
 * The collection's `extra` with its relations back under their keys, in the
 * key order MySQL gives a JSON object. With none, `extra` is returned as it
 * came (null stays null).
 *
 * @param {unknown} extra the collection's `extra`: a JSON string, an object or null
 * @param {CollectionRelations | undefined} relations
 * @returns {unknown}
 */
export function withCollectionRelations(extra, relations) {
  if (!relations) return extra
  /** @type {Record<string, unknown>} */
  const keys = {}
  const background = relations.links['historical_background']
  if (background && background.length > 0) keys['historical_background'] = [...background]
  if (relations.cover) {
    keys['thg_theme'] = {
      cover_picture: mysqlJsonOrder({
        item_id: relations.cover.item_id,
        backward_compatibility: relations.cover.backward_compatibility,
      }),
    }
  }
  if (relations.days !== null) keys['days'] = relations.days
  if (Object.keys(keys).length === 0) return extra
  const parsed = typeof extra === 'string' ? JSON.parse(extra) : extra
  return mysqlJsonOrder({ ...(isObject(parsed) ? parsed : {}), ...keys })
}

/**
 * The translation's `extra` with the collection's relations back under their
 * keys, when it is the collection's English text in its own context; any
 * other translation's `extra` is returned as it came.
 *
 * @param {unknown} extra the translation's `extra`
 * @param {CollectionRelations | undefined} relations
 * @param {{ collection_id: string, language_id: string, context_id: string }} translation
 * @returns {unknown}
 */
export function withTranslationRelations(extra, relations, translation) {
  if (!relations || translation.language_id !== 'eng' || translation.context_id !== relations.contextId) return extra
  /** @type {Record<string, unknown>} */
  const keys = {}
  if (relations.countries.length > 0) keys['country_ids'] = relations.countries.map(legacyCountryCode)
  for (const { key, kind, prefix } of TRANSLATION_LINK_KEYS) {
    const linked = relations.links[kind]
    if (linked && linked.length > 0) keys[key] = linked.map(k => legacyId(k, prefix, translation.collection_id))
  }
  if (Object.keys(keys).length === 0) return extra
  const parsed = typeof extra === 'string' ? JSON.parse(extra) : extra
  return mysqlJsonOrder({ ...(isObject(parsed) ? parsed : {}), ...keys })
}

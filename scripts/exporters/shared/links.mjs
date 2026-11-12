// @ts-check
/**
 * Links to a page of the Publications or the Travels site (M14,
 * inventory-app#2536–#2539), for the packages that point at a publication or
 * an exhibition trail without shipping it: the id, the legacy key, the title
 * per language (and a trail's subtitle, legacy's "<title> - <subtitle>"),
 * and the page on its site (`sites.mjs`).
 *
 * Types are in `links.d.mts`.
 */

import { PUBLICATION_PATH, TRAIL_PATH, loadSites, siteLink, siteOf } from './sites.mjs'

/** @param {unknown[]} values */
const marks = values => values.map(() => '?').join(', ')

/**
 * @param {unknown} extra
 * @returns {string | null}
 */
function subtitleOf(extra) {
  let value = extra
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  const subtitle = value && typeof value === 'object' ? /** @type {Record<string, unknown>} */ (value)['subtitle'] : null
  return typeof subtitle === 'string' && subtitle.trim() !== '' ? subtitle : null
}

/**
 * @param {{ id: string, language: string, title: string | null }[]} rows
 * @returns {Map<string, Record<string, string>>}
 */
function titlesById(rows) {
  const out = new Map()
  for (const row of rows) {
    if (!row.title) continue
    const titles = out.get(row.id) ?? {}
    if (titles[row.language] === undefined) titles[row.language] = row.title
    out.set(row.id, titles)
  }
  return out
}

/**
 * Links to publications on the Publications site, in the order of `ids`; an
 * id the database does not know is left out. A title is the publication's
 * own project's text when it has one, else the first context's.
 *
 * @param {import('./sites.d.mts').Query} query
 * @param {string[]} ids
 * @param {import('./sites.d.mts').Site[]} [sites]
 * @returns {Promise<import('./links.d.mts').PageLink[]>}
 */
export async function publicationLinks(query, ids, sites = loadSites()) {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return []
  const site = siteOf('publications', sites)
  const rows = /** @type {{ id: string, backward_compatibility: string | null }[]} */ (
    await query(`SELECT id, backward_compatibility FROM publications WHERE id IN (${marks(unique)}) ORDER BY id`, unique)
  )
  const titleRows = /** @type {{ id: string, language: string, title: string | null }[]} */ (
    await query(
      // Own context first, then by context: the first title per language wins.
      `SELECT pt.publication_id AS id, l.backward_compatibility AS language, pt.title
       FROM publication_translations pt
       JOIN publications p ON p.id = pt.publication_id
       JOIN languages l ON l.id = pt.language_id
       LEFT JOIN projects pr ON pr.id = p.project_id
       WHERE pt.publication_id IN (${marks(unique)}) AND l.backward_compatibility IS NOT NULL
       ORDER BY pt.publication_id, l.backward_compatibility,
                (pr.context_id IS NOT NULL AND pt.context_id = pr.context_id) DESC, pt.context_id`,
      unique
    )
  )
  const titles = titlesById(titleRows)
  const byId = new Map(rows.map(r => [r.id, r]))
  return unique
    .filter(id => byId.has(id))
    .map(id => ({
      id,
      backward_compatibility: /** @type {{ backward_compatibility: string | null }} */ (byId.get(id)).backward_compatibility,
      titles: sortedKeys(titles.get(id) ?? {}),
      ...siteLink(site, PUBLICATION_PATH, id),
    }))
}

/**
 * Links to exhibition trails on the Travels site, in the order of `ids`; an
 * id the database does not know is left out.
 *
 * @param {import('./sites.d.mts').Query} query
 * @param {string[]} ids
 * @param {import('./sites.d.mts').Site[]} [sites]
 * @returns {Promise<import('./links.d.mts').TrailLink[]>}
 */
export async function trailLinks(query, ids, sites = loadSites()) {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return []
  const site = siteOf('travels', sites)
  const rows = /** @type {{ id: string, backward_compatibility: string | null }[]} */ (
    await query(`SELECT id, backward_compatibility FROM collections WHERE id IN (${marks(unique)}) ORDER BY id`, unique)
  )
  const textRows = /** @type {{ id: string, language: string, title: string | null, extra: unknown }[]} */ (
    await query(
      // A trail is translated in its own (Travels) context first.
      `SELECT ct.collection_id AS id, l.backward_compatibility AS language, ct.title, ct.extra
       FROM collection_translations ct
       JOIN collections c ON c.id = ct.collection_id
       JOIN languages l ON l.id = ct.language_id
       WHERE ct.collection_id IN (${marks(unique)}) AND l.backward_compatibility IS NOT NULL
       ORDER BY ct.collection_id, l.backward_compatibility, (ct.context_id = c.context_id) DESC, ct.context_id`,
      unique
    )
  )
  const titles = titlesById(textRows)
  const subtitles = new Map()
  for (const row of textRows) {
    const subtitle = subtitleOf(row.extra)
    if (!subtitle) continue
    const byLang = subtitles.get(row.id) ?? {}
    if (byLang[row.language] === undefined) byLang[row.language] = subtitle
    subtitles.set(row.id, byLang)
  }
  const byId = new Map(rows.map(r => [r.id, r]))
  return unique
    .filter(id => byId.has(id))
    .map(id => ({
      id,
      backward_compatibility: /** @type {{ backward_compatibility: string | null }} */ (byId.get(id)).backward_compatibility,
      titles: sortedKeys(titles.get(id) ?? {}),
      subtitles: sortedKeys(subtitles.get(id) ?? {}),
      ...siteLink(site, TRAIL_PATH, id),
    }))
}

/**
 * @param {Record<string, string>} record
 * @returns {Record<string, string>}
 */
function sortedKeys(record) {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
}

// @ts-check
/**
 * Item references (M14, inventory-app#2536, #2537): what a site shows of an
 * item that is another site's, instead of a copy of its sheet.
 *
 * A reference is the item's id, type and legacy key, its name per language,
 * its first picture and the sites that show it (`sites.mjs`), its home site
 * first. A website lists it and links to one of those sites; the item's own
 * texts, pictures and relations stay on its own site (My Collection v3,
 * 2026-11-12: references, never copies).
 *
 * Each site link is the page that opens the item there (`pages.mjs`): an
 * Explore record opens on its monument, a Travels one in its itinerary's
 * gallery, and a mini-site, which has no item page, is left out. A link
 * never leads to "This page does not exist".
 *
 * Types are in `references.d.mts`.
 */

import { resolveItemPages } from './pages.mjs'
import { resolveItemSites, loadSites } from './sites.mjs'

const CHUNK = 500

/** @param {unknown[]} values */
const marks = values => values.map(() => '?').join(', ')

/**
 * @template T
 * @param {T[]} values
 * @returns {T[][]}
 */
function chunks(values) {
  const out = []
  for (let i = 0; i < values.length; i += CHUNK) out.push(values.slice(i, i + CHUNK))
  return out
}

/**
 * The name of each item per language: its own project's text when it has
 * one, else the first context's, as its own site would name it.
 *
 * @param {{ item_id: string, language: string, context_id: string, own_context_id: string | null, name: string | null }[]} rows
 * @returns {Map<string, Record<string, string>>}
 */
export function namesByItem(rows) {
  /** @type {Map<string, Map<string, { own: boolean, name: string }>>} */
  const picked = new Map()
  for (const row of rows) {
    const name = row.name?.trim()
    if (!name) continue
    const own = row.own_context_id !== null && row.context_id === row.own_context_id
    const byLang = picked.get(row.item_id) ?? new Map()
    const current = byLang.get(row.language)
    if (!current || (own && !current.own)) byLang.set(row.language, { own, name })
    picked.set(row.item_id, byLang)
  }
  const out = new Map()
  for (const [id, byLang] of picked) {
    const names = /** @type {Record<string, string>} */ ({})
    for (const lang of [...byLang.keys()].sort()) names[lang] = /** @type {{ name: string }} */ (byLang.get(lang)).name
    out.set(id, names)
  }
  return out
}

/**
 * References to the items, in the order of `itemIds`; an id the database
 * does not know is left out.
 *
 * @param {import('./sites.d.mts').Query} query
 * @param {string[]} itemIds
 * @param {{ baseUrl: string, sites?: import('./sites.d.mts').Site[] }} options
 * @returns {Promise<import('./references.d.mts').ItemReference[]>}
 */
export async function resolveReferences(query, itemIds, options) {
  const ids = [...new Set(itemIds)]
  if (ids.length === 0) return []
  const sites = options.sites ?? loadSites()

  /** @type {Map<string, { id: string, type: string, backward_compatibility: string | null, parent_id: string | null }>} */
  const items = new Map()
  /** @type {{ item_id: string, language: string, context_id: string, own_context_id: string | null, name: string | null }[]} */
  const nameRows = []
  /** @type {Map<string, string>} */
  const pictures = new Map()

  for (const part of chunks([...ids].sort())) {
    const rows = /** @type {{ id: string, type: string, backward_compatibility: string | null, parent_id: string | null }[]} */ (
      await query(`SELECT id, type, backward_compatibility, parent_id FROM items WHERE id IN (${marks(part)}) ORDER BY id`, part)
    )
    for (const row of rows) items.set(row.id, row)

    nameRows.push(
      .../** @type {typeof nameRows} */ (
        await query(
          // Row order is unspecified; sorted so two exports of one database are byte-identical.
          `SELECT it.item_id, l.backward_compatibility AS language, it.context_id,
                  p.context_id AS own_context_id, it.name
           FROM item_translations it
           JOIN items i ON i.id = it.item_id
           JOIN languages l ON l.id = it.language_id
           LEFT JOIN projects p ON p.id = i.project_id
           WHERE it.item_id IN (${marks(part)}) AND l.backward_compatibility IS NOT NULL
           ORDER BY it.item_id, l.backward_compatibility, it.context_id`,
          part
        )
      )
    )

    const pictureRows = /** @type {{ item_id: string, path: string }[]} */ (
      await query(
        `SELECT pic.parent_id AS item_id, ii.path
         FROM items pic
         JOIN item_images ii ON ii.item_id = pic.id
         WHERE pic.type = 'picture'
           AND pic.parent_id IN (${marks(part)})
           -- A custom exhibition photo is the exhibition's picture, not one of the item's own.
           AND NOT EXISTS (SELECT 1 FROM item_tag ct JOIN tags t ON t.id = ct.tag_id
                           WHERE ct.item_id = pic.id AND t.category = 'image-type'
                             AND t.internal_name = 'custom exhibition picture')
         ORDER BY pic.parent_id, pic.display_order IS NULL, pic.display_order, ii.display_order, pic.id`,
        part
      )
    )
    for (const row of pictureRows) if (!pictures.has(row.item_id)) pictures.set(row.item_id, row.path)
  }

  const names = namesByItem(nameRows)
  // A detail opens on its monument's page.
  const parents = new Map([...items.values()].map(item => [item.id, item.parent_id]))
  const siteLinks = await resolveItemPages(query, await resolveItemSites(query, ids, sites), sites, parents)
  return ids
    .filter(id => items.has(id))
    .map(id => {
      const item = /** @type {{ id: string, type: string, backward_compatibility: string | null, parent_id: string | null }} */ (items.get(id))
      const path = pictures.get(id)
      return {
        id,
        type: item.type,
        backward_compatibility: item.backward_compatibility,
        names: names.get(id) ?? {},
        picture: path ? `${options.baseUrl}/pub/${path}` : null,
        sites: siteLinks.get(id) ?? [],
      }
    })
}

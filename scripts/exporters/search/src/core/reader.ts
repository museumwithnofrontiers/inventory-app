/**
 * Reads, read-only, what `buildDocuments` needs from the inventory database.
 * Every query is ordered, so two exports of one database are byte-identical.
 */

import { resolveItemSites, type Query, type Site } from '../../../shared/sites.mjs'
import type { BuildInput, ItemRow, NameRow, TagRow, TranslationRow } from './documents.js'

/** The item types that have a page of their own on a site. Pictures are an item's images, not results. */
export const SEARCHED_TYPES = ['object', 'monument', 'detail']

/** Tag categories that describe an item; image types, site filters and audiences do not. */
export const TAG_CATEGORIES = ['keyword', 'material', 'type', 'artist', 'dynasty', 'subject', 'theme']

const CHUNK = 500

function chunks<T>(values: T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < values.length; i += CHUNK) out.push(values.slice(i, i + CHUNK))
  return out
}

const marks = (values: unknown[]) => values.map(() => '?').join(', ')

export async function readInput(query: Query, sites: Site[], baseUrl: string): Promise<BuildInput> {
  const q = <T>(sql: string, params?: (string | number | null)[]) => query(sql, params) as Promise<T[]>

  const items = await q<ItemRow>(
    `SELECT id, type, parent_id, backward_compatibility, mwnf_reference, owner_reference,
            start_date, end_date, partner_id, country_id
     FROM items WHERE type IN (${marks(SEARCHED_TYPES)}) ORDER BY id`,
    SEARCHED_TYPES
  )
  const ids = items.map(i => i.id)

  const translations: TranslationRow[] = []
  const tags: TagRow[] = []
  const pictures = new Map<string, string>()
  for (const part of chunks(ids)) {
    translations.push(
      ...(await q<TranslationRow>(
        `SELECT it.item_id, l.backward_compatibility AS language, it.context_id,
                p.context_id AS own_context_id, it.name, it.alternate_name, it.description, it.type,
                it.holder, it.owner, it.dates, it.location, it.place_of_production, it.provenance, it.extra
         FROM item_translations it
         JOIN items i ON i.id = it.item_id
         JOIN languages l ON l.id = it.language_id
         LEFT JOIN projects p ON p.id = i.project_id
         WHERE it.item_id IN (${marks(part)}) AND l.backward_compatibility IS NOT NULL
         ORDER BY it.item_id, l.backward_compatibility, it.context_id, it.id`,
        part
      ))
    )
    tags.push(
      ...(await q<TagRow>(
        `SELECT itg.item_id, t.description AS label, l.backward_compatibility AS language
         FROM item_tag itg
         JOIN tags t ON t.id = itg.tag_id
         LEFT JOIN languages l ON l.id = t.language_id
         WHERE itg.item_id IN (${marks(part)}) AND t.category IN (${marks(TAG_CATEGORIES)})
         ORDER BY itg.item_id, t.category, t.description, t.id`,
        [...part, ...TAG_CATEGORIES]
      ))
    )
    // The same first picture as an item reference (shared/references.mjs).
    const rows = await q<{ item_id: string; path: string }>(
      `SELECT pic.parent_id AS item_id, ii.path
       FROM items pic
       JOIN item_images ii ON ii.item_id = pic.id
       WHERE pic.type = 'picture'
         AND pic.parent_id IN (${marks(part)})
         AND NOT EXISTS (SELECT 1 FROM item_tag ct JOIN tags t ON t.id = ct.tag_id
                         WHERE ct.item_id = pic.id AND t.category = 'image-type'
                           AND t.internal_name = 'custom exhibition picture')
       ORDER BY pic.parent_id, pic.display_order IS NULL, pic.display_order, ii.display_order, pic.id`,
      part
    )
    for (const row of rows) if (!pictures.has(row.item_id)) pictures.set(row.item_id, row.path)
  }

  const partners = await q<NameRow>(
    `SELECT pt.partner_id AS id, l.backward_compatibility AS language, pt.name
     FROM partner_translations pt JOIN languages l ON l.id = pt.language_id
     WHERE l.backward_compatibility IS NOT NULL
     ORDER BY pt.partner_id, l.backward_compatibility, pt.context_id, pt.id`
  )
  const countries = await q<NameRow>(
    `SELECT ct.country_id AS id, l.backward_compatibility AS language, ct.name
     FROM country_translations ct JOIN languages l ON l.id = ct.language_id
     WHERE l.backward_compatibility IS NOT NULL
     ORDER BY ct.country_id, l.backward_compatibility, ct.id`
  )

  const siteLinks = await resolveItemSites(query, ids, sites)
  return { items, translations, tags, partners, countries, pictures, sites: siteLinks, baseUrl }
}

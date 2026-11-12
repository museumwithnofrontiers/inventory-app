import { publicationLinks } from '../../../shared/links.mjs'
import type { PageLink } from '../../../shared/links.mjs'
import type { ExportResult } from '../core/types.js'
import { type LanguageKey, languageKeyer, rekeyIfMap } from '../core/language-keys.js'
import { TRAIL_TYPE } from '../core/scope.js'
import { BaseExporter, parseJson } from './base-exporter.js'

interface CollectionRow {
  id: string
  type: string
  purpose: string | null
  internal_name: string
  backward_compatibility: string | null
  parent_id: string | null
  display_order: number | null
  country_id: string | null
  latitude: string | null
  longitude: string | null
  map_zoom: number | null
  extra: unknown
}

interface CollectionTranslationRow {
  collection_id: string
  language_id: string
  title: string
  description: string | null
  quote: string | null
  url: string | null
  extra: unknown
}

interface CollectionImageRow {
  collection_id: string
  path: string
  alt_text: string | null
  display_order: number
}

interface CollectionItemRow {
  collection_id: string
  item_id: string
  display_order: number | null
  extra: unknown
}

interface CollectionPartnerRow {
  collection_id: string
  partner_id: string
  level: string | null
}

/**
 * A trail entry: the item (a reference in references.json) and legacy's
 * justification of it per language (`extra.contextual_descriptions`).
 */
export function trailEntry(row: CollectionItemRow, languageKey: LanguageKey): Record<string, unknown> {
  const extra = parseJson(row.extra) as Record<string, unknown> | null
  const descriptions = extra?.['contextual_descriptions']
  return {
    id: row.item_id,
    display_order: row.display_order,
    contextual_descriptions:
      descriptions && typeof descriptions === 'object' ? rekeyIfMap(descriptions, languageKey) : {},
  }
}

/**
 * collections.json: the Travels tree the scope resolved (core/scope.ts), in
 * its order — the root, the exhibition trails, their itineraries and the
 * itineraries' locations.
 *
 * Each membership in `items` keeps its `extra`. An exhibition trail also
 * carries:
 * - `entries`: its own members, Islamic Art's objects and monuments, which
 *   ship as references (references.json), never as items;
 * - `partners`: the partners it links, its "Starting point" museum at level
 *   `partner`;
 * - `publications`: the publications that accompany it, each with its page on
 *   the Publications site.
 */
export class CollectionExporter extends BaseExporter {
  getName(): string {
    return 'Collections'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Exporting collections.json...')

    const collectionIds = this.scope.collectionIds
    if (collectionIds.length === 0) {
      await this.writeJson('collections.json', [])
      this.logger.warning('collections.json (0 collections)')
      return { file: 'collections.json', count: 0 }
    }
    const colPh = this.placeholders(collectionIds.length)
    const itemPh = this.placeholders(this.scope.itemIds.length)
    const trailIds = this.scope.trailIds
    const trailPh = this.placeholders(trailIds.length)
    const langCodeMap = await this.buildLangCodeMap()
    const languageKey = languageKeyer(langCodeMap)

    const [collections, translations, images, itemLinks, entryRows, partnerRows, publicationRows] =
      await Promise.all([
        this.db.query<CollectionRow>(
          `SELECT id, type, purpose, internal_name, backward_compatibility, parent_id,
                  display_order, country_id, latitude, longitude, map_zoom, extra
           FROM collections
           WHERE id IN (${colPh})`,
          collectionIds
        ),
        this.db.query<CollectionTranslationRow>(
          // Row order is unspecified; sorted so two exports of one database are byte-identical.
          `SELECT collection_id, language_id, title, description, quote, url, extra
           FROM collection_translations
           WHERE collection_id IN (${colPh})
           ORDER BY collection_id, language_id, context_id`,
          collectionIds
        ),
        this.db.query<CollectionImageRow>(
          `SELECT collection_id, path, alt_text, display_order
           FROM collection_images
           WHERE collection_id IN (${colPh})
           ORDER BY collection_id, display_order, path`,
          collectionIds
        ),
        this.scope.itemIds.length === 0
          ? Promise.resolve([] as CollectionItemRow[])
          : this.db.query<CollectionItemRow>(
              `SELECT collection_id, item_id, display_order, extra
               FROM collection_item
               WHERE collection_id IN (${colPh})
                 AND item_id IN (${itemPh})
               ORDER BY collection_id, display_order IS NULL, display_order, item_id`,
              [...collectionIds, ...this.scope.itemIds]
            ),
        this.scope.entryIds.length === 0
          ? Promise.resolve([] as CollectionItemRow[])
          : this.db.query<CollectionItemRow>(
              `SELECT collection_id, item_id, display_order, extra
               FROM collection_item
               WHERE collection_id IN (${trailPh})
                 AND item_id IN (${this.placeholders(this.scope.entryIds.length)})
               ORDER BY collection_id, display_order IS NULL, display_order, item_id`,
              [...trailIds, ...this.scope.entryIds]
            ),
        trailIds.length === 0
          ? Promise.resolve([] as CollectionPartnerRow[])
          : this.db.query<CollectionPartnerRow>(
              `SELECT collection_id, partner_id, level
               FROM collection_partner
               WHERE collection_id IN (${trailPh})
               ORDER BY collection_id, partner_id`,
              trailIds
            ),
        trailIds.length === 0
          ? Promise.resolve([] as { collection_id: string; publication_id: string }[])
          : this.db.query<{ collection_id: string; publication_id: string }>(
              `SELECT collection_id, publication_id
               FROM publication_collection
               WHERE collection_id IN (${trailPh})
               ORDER BY collection_id, display_order IS NULL, display_order, publication_id`,
              trailIds
            ),
      ])

    // collection_id -> lang_code -> fields. A collection translated in two
    // contexts keeps the first row, the sort above deciding.
    const byLang = new Map<string, Record<string, unknown>>()
    for (const t of translations) {
      const code = langCodeMap.get(t.language_id)
      if (!code) continue
      if (!byLang.has(code)) byLang.set(code, {})
      const entries = byLang.get(code)!
      if (entries[t.collection_id] !== undefined) continue
      entries[t.collection_id] = this.stripNulls({
        title: t.title,
        description: t.description,
        quote: t.quote,
        url: t.url,
        extra: parseJson(t.extra),
      })
    }
    await this.writeTranslationFiles('collections', byLang)

    const imageMap = new Map<string, { url: string; alt_text: string | null; display_order: number }[]>()
    for (const img of images) {
      if (!imageMap.has(img.collection_id)) imageMap.set(img.collection_id, [])
      imageMap.get(img.collection_id)!.push({
        url: this.imageUrl(img.path),
        alt_text: img.alt_text,
        display_order: img.display_order,
      })
    }

    const itemMap = new Map<string, Record<string, unknown>[]>()
    for (const link of itemLinks) {
      if (!itemMap.has(link.collection_id)) itemMap.set(link.collection_id, [])
      const extra = parseJson(link.extra)
      itemMap.get(link.collection_id)!.push({
        id: link.item_id,
        display_order: link.display_order,
        ...(extra ? { extra } : {}),
      })
    }

    const entryMap = new Map<string, Record<string, unknown>[]>()
    for (const row of entryRows) {
      entryMap.set(row.collection_id, [...(entryMap.get(row.collection_id) ?? []), trailEntry(row, languageKey)])
    }
    const partnerMap = new Map<string, { id: string; level: string | null }[]>()
    for (const row of partnerRows) {
      partnerMap.set(row.collection_id, [
        ...(partnerMap.get(row.collection_id) ?? []),
        { id: row.partner_id, level: row.level },
      ])
    }
    const links = await publicationLinks(
      (sql, params) => this.db.query(sql, params),
      publicationRows.map(r => r.publication_id),
      this.sites
    )
    const linkById = new Map(links.map(l => [l.id, l]))
    const publicationMap = new Map<string, PageLink[]>()
    for (const row of publicationRows) {
      const link = linkById.get(row.publication_id)
      if (link) publicationMap.set(row.collection_id, [...(publicationMap.get(row.collection_id) ?? []), link])
    }

    const byId = new Map(collections.map(c => [c.id, c]))
    const output = collectionIds
      .map(id => byId.get(id))
      .filter((c): c is CollectionRow => c !== undefined)
      .map(c => ({
        id: c.id,
        type: c.type,
        purpose: c.purpose,
        internal_name: c.internal_name,
        backward_compatibility: c.backward_compatibility,
        parent_id: c.parent_id,
        country_id: c.country_id,
        display_order: c.display_order,
        latitude: c.latitude !== null ? parseFloat(c.latitude) : null,
        longitude: c.longitude !== null ? parseFloat(c.longitude) : null,
        map_zoom: c.map_zoom,
        extra: parseJson(c.extra),
        images: imageMap.get(c.id) ?? [],
        items: itemMap.get(c.id) ?? [],
        ...(c.type === TRAIL_TYPE
          ? {
              entries: entryMap.get(c.id) ?? [],
              partners: partnerMap.get(c.id) ?? [],
              publications: publicationMap.get(c.id) ?? [],
            }
          : {}),
      }))

    await this.writeJson('collections.json', output)
    this.logger.success(`collections.json (${output.length} collections)`)

    return { file: 'collections.json', count: output.length }
  }
}

import type { ExportResult } from '../core/types.js'
import { BaseExporter } from './base-exporter.js'

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

/**
 * collections.json: the Explore tree the scope resolved (core/scope.ts), in
 * its order — the root, its three sections, then themes, countries, regions,
 * locations, itineraries and sub-itineraries.
 *
 * Explore keeps its structure in `extra`, on the collection (the site
 * records on the root, `historical_background` on a location,
 * `explore_itinerary` on an itinerary) and on a membership
 * (`explore_monument_ids` on a location's monuments, an itinerary's per-monument
 * texts), so both are shipped as they are.
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
    const langCodeMap = await this.buildLangCodeMap()

    const [collections, translations, images, itemLinks] = await Promise.all([
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

    const imageMap = new Map<
      string,
      { url: string; alt_text: string | null; display_order: number }[]
    >()
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
      }))

    await this.writeJson('collections.json', output)
    this.logger.success(`collections.json (${output.length} collections)`)

    return { file: 'collections.json', count: output.length }
  }
}

/**
 * Parses a MySQL JSON column value. mysql2 auto-decodes native JSON columns
 * into JS objects already, so `raw` is usually an object/array, not a string
 * — only fall back to JSON.parse for the (defensive) string case.
 */
function parseJson(raw: unknown): unknown | null {
  if (raw == null) return null
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw as string) as unknown
  } catch {
    return null
  }
}

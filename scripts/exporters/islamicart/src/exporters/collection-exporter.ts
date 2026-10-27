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
}

/** Per-item caption/override fields, as pivoted from legacy EAV placement metadata. */
interface CollectionItemCaption {
  name?: string
  date?: string
  dynasty?: string
  location?: string
  museum?: string
  detail_name?: string
  justification?: string
}

const CAPTION_FIELD_MAP: Record<string, keyof CollectionItemCaption> = {
  item_name: 'name',
  item_date: 'date',
  item_dynasty: 'dynasty',
  item_location: 'location',
  item_museum: 'museum',
  detail_name: 'detail_name',
  detail_justification: 'justification',
}

/** One selectable detail sub-image of an item (e.g. a close-up of one part of a monument). */
interface CollectionItemDetailEntry {
  image_url: string | null
  caption?: Record<string, CollectionItemCaption>
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

interface CollectionGlossaryRow {
  collection_id: string
  language_id: string
  glossary_id: string
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
  /** The image of the picture the placement shows, when it links one. */
  picture_path: string | null
}

export class CollectionExporter extends BaseExporter {
  getName(): string {
    return 'Collections'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Exporting collections.json...')

    // Collections are scoped to a project via its context_id.
    // All collections (root + exhibitions + themes + pages) for a project
    // share the same context_id as the project itself.
    const ph = this.placeholders(this.projectIds.length)
    const scope = this.context.scope

    // A mini-site's package holds its own subtree only.
    const collections = await this.db.query<CollectionRow>(
      `SELECT c.id, c.type, c.purpose, c.internal_name, c.backward_compatibility,
              c.parent_id, c.display_order, c.country_id, c.latitude, c.longitude
       FROM collections c
       WHERE ${
         scope
           ? `c.id IN (${this.placeholders(scope.collectionIds.length)})`
           : `c.context_id IN (SELECT p.context_id FROM projects p WHERE p.id IN (${ph}))`
       }
       ORDER BY c.parent_id IS NOT NULL, c.display_order, c.internal_name`,
      scope ? scope.collectionIds : this.projectIds
    )

    if (collections.length === 0) {
      await this.writeJson('collections.json', [])
      this.logger.warning('collections.json (0 collections)')
      return { file: 'collections.json', count: 0 }
    }

    const collectionIds = collections.map(c => c.id)
    const colPh = this.placeholders(collectionIds.length)
    const langCodeMap = await this.buildLangCodeMap()

    const [allTranslations, images, itemLinks, glossaryLinks] = await Promise.all([
      this.db.query<CollectionTranslationRow>(
        // Row order is unspecified; sorted so two exports of one database are byte-identical.
        `SELECT collection_id, language_id, title, description, quote, url, extra
         FROM collection_translations
         WHERE collection_id IN (${colPh})
         ORDER BY collection_id, language_id`,
        collectionIds
      ),
      this.db.query<CollectionImageRow>(
        `SELECT collection_id, path, alt_text, display_order
         FROM collection_images
         WHERE collection_id IN (${colPh})
         ORDER BY collection_id, display_order`,
        collectionIds
      ),
      // Items in these collections from the project. An exhibition placement
      // links the picture child item legacy showed: it ships as its parent
      // item, with that picture's image.
      this.db.query<CollectionItemRow>(
        `SELECT ci.collection_id,
                IF(i.type = 'picture', i.parent_id, i.id) AS item_id,
                ci.display_order, ci.extra,
                IF(i.type = 'picture',
                   (SELECT ii.path FROM item_images ii WHERE ii.item_id = i.id
                    ORDER BY ii.display_order, ii.id LIMIT 1),
                   NULL) AS picture_path
         FROM collection_item ci
         JOIN items i ON i.id = ci.item_id
         LEFT JOIN items parent ON parent.id = i.parent_id
         WHERE ci.collection_id IN (${colPh})
           AND ((i.type IN ('object', 'monument', 'detail') AND i.project_id IN (${ph}))
             OR (i.type = 'picture' AND parent.type IN ('object', 'monument') AND parent.project_id IN (${ph})))
         ORDER BY ci.collection_id, ci.display_order, JSON_EXTRACT(ci.extra, '$.n2'), ci.item_id`,
        [...collectionIds, ...this.projectIds, ...this.projectIds]
      ),
      // The glossary terms each text links, per language: legacy linked a
      // text's own terms (its Glossary list), never every spelling it holds.
      this.db.query<CollectionGlossaryRow>(
        `SELECT DISTINCT ct.collection_id, ct.language_id, gs.glossary_id
         FROM collection_translation_spelling cts
         JOIN collection_translations ct ON ct.id = cts.collection_translation_id
         JOIN glossary_spellings gs ON gs.id = cts.spelling_id
         WHERE ct.collection_id IN (${colPh})
         ORDER BY ct.collection_id, ct.language_id, gs.glossary_id`,
        collectionIds
      ),
    ])
    const glossaryIds = new Map<string, string[]>()
    for (const link of glossaryLinks) {
      const key = `${link.collection_id} ${link.language_id}`
      if (!glossaryIds.has(key)) glossaryIds.set(key, [])
      glossaryIds.get(key)!.push(link.glossary_id)
    }

    // The legacy site only listed exhibitions with show='y'
    // (mwnf3.exhibitions.show, preserved by the importer in
    // collection_translations.extra.legacy_exhibition.show). Unpublished
    // exhibitions — and their theme/page subtrees — stay in the inventory DB
    // as source of truth but must not ship in the data-package. No ISL
    // exhibition is show='n' today; this guards future re-imports (the BAR
    // package leaked exhibition 49 "Academia" exactly this way).
    const excludedIds = computeUnpublishedExhibitionSubtree(collections, allTranslations)
    const publishedCollections = collections.filter(c => !excludedIds.has(c.id))
    const translations = allTranslations.filter(t => !excludedIds.has(t.collection_id))
    if (excludedIds.size > 0) {
      this.logger.info(
        `Excluding ${excludedIds.size} collection(s) under unpublished (show='n') exhibitions`
      )
    }

    // collection_id -> lang_code -> fields
    const translationMap = new Map<string, Record<string, Record<string, unknown>>>()
    for (const t of translations) {
      if (!translationMap.has(t.collection_id)) translationMap.set(t.collection_id, {})
      const code = langCodeMap.get(t.language_id)
      if (!code) continue
      translationMap.get(t.collection_id)![code] = {
        title: t.title,
        description: t.description,
        quote: t.quote,
        url: t.url,
        ...(t.extra ? { extra: parseJson(t.extra) } : {}),
        ...(glossaryIds.has(`${t.collection_id} ${t.language_id}`)
          ? { glossary_ids: glossaryIds.get(`${t.collection_id} ${t.language_id}`) }
          : {}),
      }
    }

    // Write one translations/collections.{lang}.json per language (null fields omitted)
    const byLang = new Map<string, Record<string, unknown>>()
    for (const [colId, langMap] of translationMap) {
      for (const [langCode, fields] of Object.entries(langMap)) {
        if (!byLang.has(langCode)) byLang.set(langCode, {})
        byLang.get(langCode)![colId] = this.stripNulls(fields)
      }
    }
    await this.writeTranslationFiles('collections', byLang)

    // collection_id -> images[]
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

    // collection_id -> items[]
    const imageUrlFn = (path: string) => this.imageUrl(path)
    const itemMap = new Map<string, ReturnType<typeof buildCollectionItemEntry>[]>()
    for (const link of itemLinks) {
      if (!itemMap.has(link.collection_id)) itemMap.set(link.collection_id, [])
      itemMap.get(link.collection_id)!.push(buildCollectionItemEntry(link, imageUrlFn))
    }

    const output = publishedCollections.map(c => ({
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
      images: imageMap.get(c.id) ?? [],
      items: itemMap.get(c.id) ?? [],
    }))

    await this.writeJson('collections.json', output)
    this.logger.success(`collections.json (${output.length} collections)`)

    return { file: 'collections.json', count: output.length }
  }
}

/**
 * Returns the ids of every collection that is an unpublished legacy
 * exhibition (extra.legacy_exhibition.show === 'n' on any of its translation
 * rows) plus all of its descendants (themes, pages). Exported for unit tests.
 */
export function computeUnpublishedExhibitionSubtree(
  collections: Pick<CollectionRow, 'id' | 'parent_id'>[],
  translations: Pick<CollectionTranslationRow, 'collection_id' | 'extra'>[]
): Set<string> {
  const excluded = new Set<string>()
  for (const t of translations) {
    const extra = parseJson(t.extra) as Record<string, unknown> | null
    const legacy = extra?.legacy_exhibition as Record<string, unknown> | undefined
    if (typeof legacy?.show === 'string' && legacy.show.trim().toLowerCase() === 'n') {
      excluded.add(t.collection_id)
    }
  }
  if (excluded.size === 0) return excluded

  const childrenByParent = new Map<string, string[]>()
  for (const c of collections) {
    if (!c.parent_id) continue
    if (!childrenByParent.has(c.parent_id)) childrenByParent.set(c.parent_id, [])
    childrenByParent.get(c.parent_id)!.push(c.id)
  }
  const queue = [...excluded]
  while (queue.length > 0) {
    const id = queue.pop()!
    for (const childId of childrenByParent.get(id) ?? []) {
      if (!excluded.has(childId)) {
        excluded.add(childId)
        queue.push(childId)
      }
    }
  }
  return excluded
}

/**
 * Pivots caption/override fields (item_name, item_date, item_dynasty,
 * item_location, item_museum, detail_name, detail_justification — each a
 * language-keyed map) into a per-language caption record.
 */
function extractCaptions(fields: Record<string, unknown>): Record<string, CollectionItemCaption> {
  const caption: Record<string, CollectionItemCaption> = {}
  for (const [legacyField, outField] of Object.entries(CAPTION_FIELD_MAP)) {
    const langMap = fields[legacyField]
    if (!langMap || typeof langMap !== 'object') continue
    for (const [lang, text] of Object.entries(langMap as Record<string, string>)) {
      if (!text) continue
      if (!caption[lang]) caption[lang] = {}
      caption[lang]![outField] = text
    }
  }
  return caption
}

/**
 * Builds one collections.json item entry from a collection_item pivot row.
 * Exported for unit tests.
 *
 * `extra` holds legacy placement metadata: `n`/`n2` (grid row/column — items
 * sharing the same row can have several selectable variants at different
 * columns, mirroring the legacy artintro/exhibition thumbnail-grid UI),
 * per-language caption overrides, and — for exhibitions only — a `details`
 * array of additional selectable sub-images of the same item (e.g. a
 * close-up of one part of a monument), each with its own image and caption.
 */
export function buildCollectionItemEntry(
  link: CollectionItemRow,
  imageUrlFn: (path: string) => string
): {
  id: string
  display_order: number | null
  variant_order: number | null
  image_url?: string
  caption?: Record<string, CollectionItemCaption>
  details?: CollectionItemDetailEntry[]
} {
  const extra = parseJson(link.extra) as Record<string, unknown> | null
  const variantOrder = extra && typeof extra.n2 === 'number' ? extra.n2 : null
  const caption = extra ? extractCaptions(extra) : {}

  const details: CollectionItemDetailEntry[] = []
  if (extra && Array.isArray(extra.details)) {
    for (const raw of extra.details as Record<string, unknown>[]) {
      const picture = typeof raw.picture_details === 'string' ? raw.picture_details : null
      const detailCaption = extractCaptions(raw)
      details.push({
        image_url: picture ? imageUrlFn(picture) : null,
        ...(Object.keys(detailCaption).length > 0 ? { caption: detailCaption } : {}),
      })
    }
  }

  return {
    id: link.item_id,
    display_order: link.display_order,
    variant_order: variantOrder,
    ...(link.picture_path ? { image_url: imageUrlFn(link.picture_path) } : {}),
    ...(Object.keys(caption).length > 0 ? { caption } : {}),
    ...(details.length > 0 ? { details } : {}),
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

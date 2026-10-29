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

interface CollectionImageRow {
  id: string
  collection_id: string
  path: string
  alt_text: string | null
  display_order: number
  extra: unknown
}

interface CollectionImageTypeRow {
  collection_image_id: string
  type: string
}

interface CollectionItemRow {
  collection_id: string
  item_id: string
  display_order: number | null
  extra: unknown
  /** The image of the picture item a theme or subtheme image places. */
  picture_path?: string | null
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

    const [allTranslations, images, imageTypes, itemLinks] = await Promise.all([
      this.db.query<CollectionTranslationRow>(
        // Row order is unspecified; sorted so two exports of one database are byte-identical.
        `SELECT collection_id, language_id, title, description, quote, url, extra
         FROM collection_translations
         WHERE collection_id IN (${colPh})
         ORDER BY collection_id, language_id`,
        collectionIds
      ),
      this.db.query<CollectionImageRow>(
        `SELECT id, collection_id, path, alt_text, display_order, extra
         FROM collection_images
         WHERE collection_id IN (${colPh})
         ORDER BY collection_id, display_order, id`,
        collectionIds
      ),
      // What each image is on the exhibition's pages (its home image, its
      // thumbnail, a partner logo…): its `image-type` tag, matched on the
      // tag's identity, as the DXA exporters match the logo tag.
      this.db.query<CollectionImageTypeRow>(
        `SELECT cit.collection_image_id, t.internal_name AS type
         FROM collection_image_tag cit
         JOIN tags t ON t.id = cit.tag_id
         JOIN collection_images ci ON ci.id = cit.collection_image_id
         WHERE ci.collection_id IN (${colPh}) AND t.category = 'image-type'
         ORDER BY cit.collection_image_id, t.internal_name`,
        collectionIds
      ),
      // Items in these collections from the project. A theme or subtheme image
      // places the picture item legacy showed: it ships as its parent item,
      // with that picture's image (mergePlacements below).
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
         ORDER BY ci.collection_id, ci.display_order, JSON_EXTRACT(ci.extra, '$.n2'), item_id`,
        [...collectionIds, ...this.projectIds, ...this.projectIds]
      ),
    ])

    // The legacy site only listed exhibitions with show='y'
    // (mwnf3.exhibitions.show, preserved by the importer in
    // collection_translations.extra.legacy_exhibition.show). Unpublished
    // exhibitions — and their theme/page subtrees — stay in the inventory DB
    // as source of truth but must not ship in the data-package (e.g. BAR
    // exhibition 49 "Academia", which has themes but no content).
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
    const typeOf = new Map(imageTypes.map(row => [row.collection_image_id, row.type]))
    const imageMap = new Map<string, ReturnType<typeof buildCollectionImageEntry>[]>()
    for (const img of images) {
      if (!imageMap.has(img.collection_id)) imageMap.set(img.collection_id, [])
      imageMap
        .get(img.collection_id)!
        .push(buildCollectionImageEntry(img, typeOf.get(img.id) ?? null, this.imageUrl(img.path)))
    }

    // collection_id -> items[]
    const imageUrlFn = (path: string) => this.imageUrl(path)
    const itemMap = new Map<string, ReturnType<typeof buildCollectionItemEntry>[]>()
    for (const link of itemLinks) {
      if (!itemMap.has(link.collection_id)) itemMap.set(link.collection_id, [])
      itemMap.get(link.collection_id)!.push(buildCollectionItemEntry(link, imageUrlFn))
    }
    for (const [collectionId, entries] of itemMap) itemMap.set(collectionId, mergePlacements(entries))

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
 * One collections.json image entry. `type` is what the image is on the
 * exhibition's pages (its `image-type` tag: `home image`, `thumbnail`,
 * `portal image`, `logo`), and `link` where a partner logo leads (its
 * `extra.link`). Exported for unit tests.
 */
export function buildCollectionImageEntry(
  img: Pick<CollectionImageRow, 'alt_text' | 'display_order' | 'extra'>,
  type: string | null,
  url: string
): { url: string; alt_text: string | null; display_order: number; type?: string; link?: string } {
  const extra = parseJson(img.extra) as Record<string, unknown> | null
  const link = typeof extra?.link === 'string' && extra.link.trim() ? extra.link : null
  return {
    url,
    alt_text: img.alt_text,
    display_order: img.display_order,
    ...(type ? { type } : {}),
    ...(link ? { link } : {}),
  }
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
 *
 * `extra` holds legacy placement metadata: `n`/`n2` (grid row/column — items
 * sharing the same row can have several selectable variants at different
 * columns, mirroring the legacy artintro/exhibition thumbnail-grid UI),
 * per-language caption overrides, and — for exhibitions only — a `details`
 * array of additional selectable sub-images of the same item (e.g. a
 * close-up of one part of a monument), each with its own image and caption.
 */
function buildCollectionItemEntry(
  link: CollectionItemRow,
  imageUrlFn: (path: string) => string
): {
  id: string
  display_order: number | null
  variant_order: number | null
  image_url?: string
  caption?: Record<string, CollectionItemCaption>
  details?: CollectionItemDetailEntry[]
  justifications?: Record<string, { partner: string | null; curator: string | null }>
  curator_status?: string
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

  // SH-specific placement metadata (importers ShExhibitionItemImporter +
  // sh-exhibition-item-justifications): per-language curator/partner
  // justification texts and the relation's curator_status flag — rendered by
  // the legacy PC browser as the curator-vs-partner hover cards.
  const justifications =
    extra && typeof extra.justifications === 'object' && extra.justifications
      ? (extra.justifications as Record<string, { partner: string | null; curator: string | null }>)
      : null
  const curatorStatus = typeof extra?.curator_status === 'string' ? extra.curator_status : null

  return {
    id: link.item_id,
    display_order: link.display_order,
    variant_order: variantOrder,
    ...(link.picture_path ? { image_url: imageUrlFn(link.picture_path) } : {}),
    ...(Object.keys(caption).length > 0 ? { caption } : {}),
    ...(details.length > 0 ? { details } : {}),
    ...(justifications && Object.keys(justifications).length > 0 ? { justifications } : {}),
    ...(curatorStatus ? { curator_status: curatorStatus } : {}),
  }
}

/**
 * One collection's entries, merged. A collection places an item twice over:
 * the rel_* table relates it (with the curator's and partner's
 * justification), and an image table shows one of its pictures at a position
 * (`image_url`, one entry per view). Each picture entry takes its item's
 * justification; a relation whose item a picture shows is then dropped, so an
 * item is listed once per picture it shows, or once. Exported for unit tests.
 */
export function mergePlacements<
  T extends {
    id: string
    image_url?: string
    justifications?: Record<string, { partner: string | null; curator: string | null }>
    curator_status?: string
  },
>(entries: T[]): T[] {
  const shown = new Set(entries.filter(e => e.image_url).map(e => e.id))
  const related = new Map(entries.filter(e => !e.image_url).map(e => [e.id, e]))
  return entries
    .filter(e => e.image_url || !shown.has(e.id))
    .map(e => {
      const relation = e.image_url ? related.get(e.id) : undefined
      if (!relation) return e
      return {
        ...e,
        ...(relation.justifications && !e.justifications ? { justifications: relation.justifications } : {}),
        ...(relation.curator_status && !e.curator_status ? { curator_status: relation.curator_status } : {}),
      }
    })
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

import type { ExportResult } from '../core/types.js'
import { loadMinisiteInstances } from '../minisite/instance.js'
import { BaseExporter } from './base-exporter.js'

/** The site this exporter's own package is, as the mini-site instances name it. */
const SITE_KEY = 'baroqueart'

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
  artist?: string
  material?: string
  detail_name?: string
  justification?: string
}

const CAPTION_FIELD_MAP: Record<string, keyof CollectionItemCaption> = {
  item_name: 'name',
  item_date: 'date',
  item_dynasty: 'dynasty',
  item_location: 'location',
  item_museum: 'museum',
  // Baroque Art's exhibition pages print the artist and the material lines too.
  item_artist: 'artist',
  item_material: 'material',
  detail_name: 'detail_name',
  detail_justification: 'justification',
}

/** One selectable detail sub-image of an item (e.g. a close-up of one part of a monument). */
interface CollectionItemDetailEntry {
  /** The record the view shows (DetailViewRow.record_id). */
  id?: string
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

/** A detail view of a placement: a placement of its own whose extra carries `parent_n2`. */
export interface DetailViewRow {
  collection_id: string
  /**
   * The record the view shows: the monument detail whose picture it links (or
   * the detail itself), else the item its own picture belongs to. Legacy's
   * captions fell back on the monument detail's texts.
   */
  record_id: string | null
  /** The object or monument the view shows a part of: the placement's record. */
  owner_id: string | null
  display_order: number | null
  extra: unknown
  /** The image of the picture the view shows, when it links one. */
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

    const [allTranslations, images, itemLinks, detailViews, glossaryLinks] = await Promise.all([
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
      // Items in these collections, as items that exist as top-level rows in
      // items.json — 'picture' and 'detail' children are embedded on their
      // parent there (#1515), so a membership row pointing at one would
      // dangle. An exhibition placement links the picture child item legacy
      // showed: it ships as its parent item, with that picture's image. A
      // mini-site also ships the custom photos placed with no item, each a
      // picture of its own with no parent.
      this.db.query<CollectionItemRow>(
        `SELECT ci.collection_id,
                IF(i.type = 'picture' AND i.parent_id IS NOT NULL, i.parent_id, i.id) AS item_id,
                ci.display_order, ci.extra,
                IF(i.type = 'picture',
                   (SELECT ii.path FROM item_images ii WHERE ii.item_id = i.id
                    ORDER BY ii.display_order, ii.id LIMIT 1),
                   NULL) AS picture_path
         FROM collection_item ci
         JOIN items i ON i.id = ci.item_id
         LEFT JOIN items parent ON parent.id = i.parent_id
         WHERE ci.collection_id IN (${colPh})
           AND JSON_EXTRACT(ci.extra, '$.parent_n2') IS NULL
           AND ((i.type IN ('object', 'monument') AND i.project_id IN (${ph}))
             OR (i.type = 'picture' AND parent.type IN ('object', 'monument') AND parent.project_id IN (${ph}))${
               scope ? `\n             OR (i.type = 'picture' AND i.parent_id IS NULL AND i.project_id IN (${ph}))` : ''
             })
         ORDER BY ci.collection_id, ci.display_order, JSON_EXTRACT(ci.extra, '$.n2'), ci.item_id`,
        [...collectionIds, ...this.projectIds, ...this.projectIds, ...(scope ? this.projectIds : [])]
      ),
      // A placement's detail views ship inside it, as its `details`: the
      // pictures legacy showed in its place, each with its own texts.
      this.db.query<DetailViewRow>(
        `SELECT ci.collection_id,
                IF(i.type = 'picture', i.parent_id, i.id) AS record_id,
                CASE
                  WHEN i.type = 'picture' AND parent.type = 'detail' THEN parent.parent_id
                  WHEN i.type = 'picture' AND parent.type IN ('object', 'monument') THEN parent.id
                  WHEN i.type = 'detail' THEN i.parent_id
                END AS owner_id,
                ci.display_order, ci.extra,
                IF(i.type = 'picture',
                   (SELECT ii.path FROM item_images ii WHERE ii.item_id = i.id
                    ORDER BY ii.display_order, ii.id LIMIT 1),
                   NULL) AS picture_path
         FROM collection_item ci
         JOIN items i ON i.id = ci.item_id
         LEFT JOIN items parent ON parent.id = i.parent_id
         WHERE ci.collection_id IN (${colPh})
           AND JSON_EXTRACT(ci.extra, '$.parent_n2') IS NOT NULL
         ORDER BY ci.collection_id, JSON_EXTRACT(ci.extra, '$.n'), JSON_EXTRACT(ci.extra, '$.parent_n2'),
                  JSON_EXTRACT(ci.extra, '$.n2'), ci.item_id`,
        collectionIds
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

    // An exhibition that is a mini-site of its own (inventory-app#2359)
    // keeps here only what this site shows of it: its title (the exhibitions
    // list), its themes' titles and which items its pages place, in their
    // order (an item sheet's "on display in" link to the mini-site page).
    // Its texts, quotes, introduction, captions and pictures are the
    // mini-site's package's.
    const minisite = scope
      ? new Map<string, number>()
      : minisiteDepths(publishedCollections, loadMinisiteInstances(SITE_KEY).map(i => i.collectionId))
    if (minisite.size > 0) {
      this.logger.info(`Keeping titles and page placements only of ${minisite.size} mini-site collection(s)`)
    }

    // collection_id -> lang_code -> fields
    const translationMap = new Map<string, Record<string, Record<string, unknown>>>()
    for (const t of translations) {
      const depth = minisite.get(t.collection_id)
      if (depth !== undefined) {
        // A page's title is the mini-site's: the link names the exhibition and the theme.
        if (depth >= 2) continue
        const code = langCodeMap.get(t.language_id)
        if (!code) continue
        if (!translationMap.has(t.collection_id)) translationMap.set(t.collection_id, {})
        translationMap.get(t.collection_id)![code] = { title: t.title }
        continue
      }
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
      if (minisite.has(img.collection_id)) continue
      if (!imageMap.has(img.collection_id)) imageMap.set(img.collection_id, [])
      imageMap.get(img.collection_id)!.push({
        url: this.imageUrl(img.path),
        alt_text: img.alt_text,
        display_order: img.display_order,
      })
    }

    // collection_id -> items[]
    const imageUrlFn = (path: string) => this.imageUrl(path)
    const viewsOf = groupDetailViews(detailViews)
    const itemMap = new Map<string, ReturnType<typeof buildCollectionItemEntry>[]>()
    for (const link of itemLinks) {
      const depth = minisite.get(link.collection_id)
      // Legacy's item sheet linked the pages that place an item, not an
      // exhibition's introduction: a mini-site page keeps its items, bare.
      if (depth !== undefined && depth < 2) continue
      if (!itemMap.has(link.collection_id)) itemMap.set(link.collection_id, [])
      const entries = itemMap.get(link.collection_id)!
      if (depth === undefined) {
        const extra = parseJson(link.extra) as Record<string, unknown> | null
        const views = viewsOf.get(detailViewKey(link.collection_id, extra?.n, extra?.n2)) ?? []
        entries.push(buildCollectionItemEntry(link, imageUrlFn, views))
      } else if (!entries.some(e => e.id === link.item_id)) {
        entries.push({ id: link.item_id, display_order: link.display_order, variant_order: null })
      }
    }
    // Legacy could place a monument twice at one position, once with its
    // picture and once only to carry detail views; the inventory keeps one
    // membership per item, so those views have no placement of their own and
    // ship under one made for them.
    const placedKeys = new Set(
      itemLinks.map(link => {
        const extra = parseJson(link.extra) as Record<string, unknown> | null
        return detailViewKey(link.collection_id, extra?.n, extra?.n2)
      })
    )
    for (const placement of unplacedDetailViews(viewsOf, placedKeys)) {
      const depth = minisite.get(placement.collection_id)
      if (depth !== undefined && depth < 2) continue
      if (!itemMap.has(placement.collection_id)) itemMap.set(placement.collection_id, [])
      const entries = itemMap.get(placement.collection_id)!
      if (depth === undefined) {
        entries.push(buildCollectionItemEntry(placement, imageUrlFn, viewsOf.get(placement.key)!))
      } else if (!entries.some(e => e.id === placement.item_id)) {
        entries.push({ id: placement.item_id, display_order: placement.display_order, variant_order: null })
      }
      entries.sort(
        (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || (a.variant_order ?? 0) - (b.variant_order ?? 0)
      )
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
 * Every collection of the subtrees rooted at `rootIds`, with its depth below
 * its root: 0 the exhibition, 1 a theme, 2 a page. Exported for unit tests.
 */
export function minisiteDepths(
  collections: Pick<CollectionRow, 'id' | 'parent_id'>[],
  rootIds: string[]
): Map<string, number> {
  const childrenByParent = new Map<string, string[]>()
  for (const c of collections) {
    if (!c.parent_id) continue
    if (!childrenByParent.has(c.parent_id)) childrenByParent.set(c.parent_id, [])
    childrenByParent.get(c.parent_id)!.push(c.id)
  }
  const present = new Set(collections.map(c => c.id))
  const depths = new Map<string, number>()
  const queue: Array<[string, number]> = rootIds.filter(id => present.has(id)).map(id => [id, 0])
  for (const [id] of queue) depths.set(id, 0)
  while (queue.length > 0) {
    const [id, depth] = queue.shift()!
    for (const childId of childrenByParent.get(id) ?? []) {
      if (depths.has(childId)) continue
      depths.set(childId, depth + 1)
      queue.push([childId, depth + 1])
    }
  }
  return depths
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

/** The placement a detail view belongs to: its page, its position and the placement's n2. */
function detailViewKey(collectionId: string, n: unknown, n2: unknown): string {
  return `${collectionId}|${String(n)}|${String(n2)}`
}

/**
 * Groups detail views by the placement they belong to (same page, same n,
 * `parent_n2` = the placement's n2), in their query order. Exported for unit
 * tests.
 */
export function groupDetailViews(views: DetailViewRow[]): Map<string, DetailViewRow[]> {
  const map = new Map<string, DetailViewRow[]>()
  for (const view of views) {
    const extra = parseJson(view.extra) as Record<string, unknown> | null
    const key = detailViewKey(view.collection_id, extra?.n, extra?.parent_n2)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(view)
  }
  return map
}

/**
 * The detail views no placement carries (`placedKeys`, the placements'
 * detailViewKey), each group as the placement legacy showed them in: the
 * object or monument they show, at their position, its n2 their
 * `parent_n2`. A group whose record is no part of an item is left out.
 * Exported for unit tests.
 */
export function unplacedDetailViews(
  viewsOf: Map<string, DetailViewRow[]>,
  placedKeys: Set<string>
): (CollectionItemRow & { key: string })[] {
  const placements: (CollectionItemRow & { key: string })[] = []
  for (const [key, views] of viewsOf) {
    const owner = views.find(view => view.owner_id)?.owner_id
    if (placedKeys.has(key) || !owner) continue
    const extra = parseJson(views[0].extra) as Record<string, unknown> | null
    placements.push({
      key,
      collection_id: views[0].collection_id,
      item_id: owner,
      display_order: views[0].display_order,
      extra: { n: extra?.n, n2: extra?.parent_n2 },
      picture_path: null,
    })
  }
  return placements
}

/**
 * Builds one collections.json item entry from a collection_item pivot row.
 * Exported for unit tests.
 *
 * `extra` holds legacy placement metadata: `n`/`n2` (grid row/column — items
 * sharing the same row can have several selectable variants at different
 * columns, mirroring the legacy artintro/exhibition thumbnail-grid UI) and
 * per-language caption overrides. `views` are the placement's detail views
 * (exhibitions only): the pictures legacy showed in its place (e.g. a
 * close-up of one part of a monument), each with its own image and caption,
 * shipped as its `details`.
 */
export function buildCollectionItemEntry(
  link: CollectionItemRow,
  imageUrlFn: (path: string) => string,
  views: DetailViewRow[] = []
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

  const details: CollectionItemDetailEntry[] = views.map(view => {
    const viewExtra = parseJson(view.extra) as Record<string, unknown> | null
    const detailCaption = viewExtra ? extractCaptions(viewExtra) : {}
    return {
      ...(view.record_id ? { id: view.record_id } : {}),
      image_url: view.picture_path ? imageUrlFn(view.picture_path) : null,
      ...(Object.keys(detailCaption).length > 0 ? { caption: detailCaption } : {}),
    }
  })

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

import type { ExportResult } from '../core/types.js'
import { BaseExporter } from './base-exporter.js'

interface ItemRow {
  id: string
  type: string
  internal_name: string
  backward_compatibility: string | null
  parent_id: string | null
  partner_id: string | null
  country_id: string | null
  collection_id: string | null
  project_id: string | null
  owner_reference: string | null
  mwnf_reference: string | null
  start_date: number | null
  end_date: number | null
  display_order: number | null
  latitude: string | null
  longitude: string | null
}

interface ItemTranslationRow {
  item_id: string
  language_id: string
  context_id: string
  name: string
  alternate_name: string | null
  description: string | null
  type: string | null
  holder: string | null
  owner: string | null
  initial_owner: string | null
  dates: string | null
  location: string | null
  dimensions: string | null
  place_of_production: string | null
  method_for_datation: string | null
  method_for_provenance: string | null
  provenance: string | null
  obtention: string | null
  bibliography: string | null
  extra: unknown
  author_name: string | null
  copy_editor_name: string | null
  translator_name: string | null
  translation_copy_editor_name: string | null
}

interface PictureItemRow {
  picture_id: string
  item_id: string // parent_id
  display_order: number | null
  path: string
  alt_text: string | null
}

interface PictureTranslationRow {
  picture_id: string
  language_id: string
  caption: string | null // description field on picture item translations
  extra: unknown // JSON: { photographer, copyright }
}

interface ItemDynastyRow {
  item_id: string
  dynasty_id: string
}

interface ItemItemLinkRow {
  source_id: string
  target_id: string
  language_id: string
  justification: string | null
}

interface ItemTagRow {
  item_id: string
  tag: string
}

interface ItemGlossaryRow {
  item_id: string
  glossary_id: string
}

interface ItemArtistRow {
  item_id: string
  name: string
}

interface ItemMediaRow {
  item_id: string
  language_id: string | null
  type: string
  title: string
  description: string | null
  url: string
}

interface ItemThgGalleryRow {
  item_id: string
  name: string | null
  internal_name: string
}

export class ItemExporter extends BaseExporter {
  getName(): string {
    return 'Items'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Exporting items.json...')

    const ph = this.placeholders(this.projectIds.length)

    // Only 'object' and 'monument' become top-level rows. The legacy site
    // never displayed monument details as items (browse unions objects +
    // monuments only; search surfaces the PARENT monument for a detail-text
    // hit) — details are embedded as details[] on their parent monument
    // below (museumwithnofrontiers/inventory-app#1515). 'picture' child items are
    // likewise excluded — those are exported as images on their parent.
    const items = await this.db.query<ItemRow>(
      `SELECT id, type, internal_name, backward_compatibility, parent_id,
              partner_id, country_id, collection_id, project_id,
              owner_reference, mwnf_reference, start_date, end_date,
              display_order, latitude, longitude
       FROM items
       WHERE project_id IN (${ph})
         AND type IN ('object', 'monument')
       ORDER BY type, display_order, internal_name`,
      this.projectIds
    )

    if (items.length === 0) {
      await this.writeJson('items.json', [])
      this.logger.warning('items.json (0 items)')
      return { file: 'items.json', count: 0 }
    }

    const itemIds = items.map(i => i.id)
    const itemPh = this.placeholders(itemIds.length)
    const langCodeMap = await this.buildLangCodeMap()

    const contextIds = this.context.contextIds
    const contextPh = this.placeholders(contextIds.length)

    // Each item's "own" context — resolved via its project's context_id.
    // An item can have item_translations rows in more than one context (e.g. a
    // monument cross-cataloged under both ISL and EPM projects gets one row
    // per context, by design — contexts are additive, not overlapping
    // duplicates). Used below to know which row is the item's primary
    // translation vs. a secondary one (see short_description handling).
    const itemProjectIds = [
      ...new Set(items.map(i => i.project_id).filter((p): p is string => !!p)),
    ]
    const itemOwnContext = new Map<string, string>()
    if (itemProjectIds.length > 0) {
      const projectRows = await this.db.query<{ id: string; context_id: string | null }>(
        `SELECT id, context_id FROM projects WHERE id IN (${this.placeholders(itemProjectIds.length)})`,
        itemProjectIds
      )
      const projectContextMap = new Map(
        projectRows.filter(p => p.context_id).map(p => [p.id, p.context_id as string])
      )
      for (const item of items) {
        const ctx = item.project_id ? projectContextMap.get(item.project_id) : undefined
        if (ctx) itemOwnContext.set(item.id, ctx)
      }
    }

    // ── 1a. Monument details (embedded, never top-level) ─────────────────────
    // Legacy semantics (#1515): monument_details render only inline as the
    // parent monument's "Special Features" section; browse and search never
    // list them. They are fetched here and folded into details[] on the
    // parent item below.
    const detailRows = await this.db.query<DetailRow>(
      `SELECT id, internal_name, backward_compatibility, parent_id, display_order
       FROM items
       WHERE project_id IN (${ph})
         AND type = 'detail'
       ORDER BY parent_id, display_order, internal_name`,
      this.projectIds
    )

    // Some details were imported with parent_id = null (the importer logs
    // "Parent monument not found" and keeps going). Their legacy key still
    // names the parent monument, so recover the link via
    // backward_compatibility; anything still unresolved is dropped with a
    // warning — parent-less details are never exported.
    const {
      byParent: detailsByParent,
      orphans: orphanDetails,
      recovered: recoveredDetails,
    } = resolveDetailParents(detailRows, items)
    if (recoveredDetails.length > 0) {
      this.logger.info(
        `Recovered ${recoveredDetails.length} detail(s) with parent_id=null via backward_compatibility`
      )
    }
    if (orphanDetails.length > 0) {
      const sample = orphanDetails
        .slice(0, 5)
        .map(d => d.backward_compatibility ?? d.id)
        .join(', ')
      this.logger.warning(
        `Dropping ${orphanDetails.length} orphan detail(s) with no resolvable parent monument (e.g. ${sample})`
      )
    }
    const embeddedDetails = [...detailsByParent.values()].flat()
    const detailIds = embeddedDetails.map(d => d.id)

    // The importer stores detail translations under the DEFAULT context
    // (monument-detail-importer.ts writes context_id = defaultContextId),
    // not the project context the main translation query filters on — the
    // deliberate exporter-side fix for #1515's translation-context gap is to
    // read the default-context rows here. A project-context row still wins
    // when one exists, so a later importer alignment needs no exporter change.
    let detailTranslations: DetailTranslationRow[] = []
    if (detailIds.length > 0) {
      const defaultContextRows = await this.db.query<{ id: string }>(
        `SELECT id FROM contexts WHERE is_default = 1`
      )
      const detailContextIds = [...new Set([...contextIds, ...defaultContextRows.map(r => r.id)])]
      detailTranslations = await this.db.query<DetailTranslationRow>(
        `SELECT item_id, language_id, context_id, name, description, dates, location
         FROM item_translations
         WHERE item_id IN (${this.placeholders(detailIds.length)})
           AND context_id IN (${this.placeholders(detailContextIds.length)})`,
        [...detailIds, ...detailContextIds]
      )
    }

    // detail_id -> lang_code -> fields (project-context row wins over default)
    const detailTransMap = new Map<string, Record<string, Record<string, unknown>>>()
    const detailLangFromProjectContext = new Set<string>()
    for (const t of detailTranslations) {
      const code = langCodeMap.get(t.language_id)
      if (!code) continue
      const key = `${t.item_id} ${code}`
      const isProjectContext = contextIds.includes(t.context_id)
      if (detailLangFromProjectContext.has(key) && !isProjectContext) continue
      if (isProjectContext) detailLangFromProjectContext.add(key)
      if (!detailTransMap.has(t.item_id)) detailTransMap.set(t.item_id, {})
      detailTransMap.get(t.item_id)![code] = {
        name: t.name,
        description: t.description,
        dates: t.dates,
        location: t.location,
      }
    }

    // ── 1. Content translations (name, description, …) ──────────────────────
    // Filter by context_id so that explore-context translations (which may have
    // extra=null) do not overwrite the canonical project translations.
    const translations = await this.db.query<ItemTranslationRow>(
      `SELECT it.item_id, it.language_id, it.context_id,
              it.name, it.alternate_name, it.description,
              it.type, it.holder, it.owner, it.initial_owner, it.dates,
              it.location, it.dimensions, it.place_of_production,
              it.method_for_datation, it.method_for_provenance,
              it.provenance, it.obtention, it.bibliography, it.extra,
              a1.name AS author_name,
              a2.name AS copy_editor_name,
              a3.name AS translator_name,
              a4.name AS translation_copy_editor_name
       FROM item_translations it
       LEFT JOIN authors a1 ON a1.id = it.author_id
       LEFT JOIN authors a2 ON a2.id = it.text_copy_editor_id
       LEFT JOIN authors a3 ON a3.id = it.translator_id
       LEFT JOIN authors a4 ON a4.id = it.translation_copy_editor_id
       WHERE it.item_id IN (${itemPh})
         AND it.context_id IN (${contextPh})`,
      [...itemIds, ...contextIds]
    )

    // ── 2. Images via picture child items ────────────────────────────────────
    // Each image is a child item of type 'picture'. It carries:
    //   - items.display_order  → position in the gallery
    //   - item_images.path     → the file path
    //   - item_translations.description (caption, per language)
    //   - item_translations.extra JSON { photographer, copyright }
    // Embedded details own picture children too (monument_detail_pictures →
    // 'picture' items under the detail), so their ids join the parent list;
    // the shared imageMap below then serves items and details alike.
    const itemAndDetailIds = [...itemIds, ...detailIds]
    const pictureItems = await this.db.query<PictureItemRow>(
      `SELECT pic.id AS picture_id, pic.parent_id AS item_id,
              pic.display_order, ii.path, ii.alt_text
       FROM items pic
       JOIN item_images ii ON ii.item_id = pic.id
       WHERE pic.type = 'picture'
         AND pic.parent_id IN (${this.placeholders(itemAndDetailIds.length)})
       ORDER BY pic.parent_id, pic.display_order`,
      itemAndDetailIds
    )

    let pictureTranslations: PictureTranslationRow[] = []
    if (pictureItems.length > 0) {
      const pictureIds = [...new Set(pictureItems.map(p => p.picture_id))]
      pictureTranslations = await this.db.query<PictureTranslationRow>(
        `SELECT item_id AS picture_id, language_id, description AS caption, extra
         FROM item_translations
         WHERE item_id IN (${this.placeholders(pictureIds.length)})`,
        pictureIds
      )
    }

    // ── 3. Dynasty, tag, glossary, artist, THG gallery, media, and item-item links ──
    const [
      dynastyLinks,
      tagLinks,
      glossaryLinks,
      artistLinks,
      thgGalleryLinks,
      mediaRows,
      itemItemLinks,
    ] = await Promise.all([
      this.db.query<ItemDynastyRow>(
        `SELECT item_id, dynasty_id FROM item_dynasty WHERE item_id IN (${itemPh})`,
        itemIds
      ),
      this.db.query<ItemTagRow>(
        `SELECT it2.item_id, t.description AS tag
         FROM item_tag it2
         JOIN tags t ON t.id = it2.tag_id
         WHERE it2.item_id IN (${itemPh})`,
        itemIds
      ),
      // Glossary terms used anywhere in this item's translations (any language),
      // via item_translations -> item_translation_spelling -> glossary_spellings.
      this.db.query<ItemGlossaryRow>(
        `SELECT DISTINCT it3.item_id, gs.glossary_id
         FROM item_translation_spelling its
         JOIN item_translations it3 ON it3.id = its.item_translation_id
         JOIN glossary_spellings gs ON gs.id = its.spelling_id
         WHERE it3.item_id IN (${itemPh})`,
        itemIds
      ),
      // Object artists (legacy `artist_` text, parsed into structured Artist
      // entities by the importer). Language-independent — `artists.name` has
      // no language column — so this is a top-level item field, not per-translation.
      // Embedded details carry artists too (legacy monument_details.artist),
      // so their ids are included; the shared artistMap serves both.
      this.db.query<ItemArtistRow>(
        `SELECT ai.item_id, a.name
         FROM artist_item ai
         JOIN artists a ON a.id = ai.artist_id
         WHERE ai.item_id IN (${this.placeholders(itemAndDetailIds.length)})`,
        itemAndDetailIds
      ),
      // THG (Thematic Gallery) cross-references — a separate legacy project's
      // galleries that also feature this item, already linked via
      // ThgGalleryMwnf3{Object,Monument}Importer (phase-10) attaching the item
      // to the gallery's own `collection_item` row. THG's own collection tree
      // is intentionally never exported (out of scope, separate site) — this
      // is a lightweight, scoped-by-prefix lookup, not a full THG export.
      this.db.query<ItemThgGalleryRow>(
        `SELECT ci.item_id, ct.title AS name, c.internal_name
         FROM collection_item ci
         JOIN collections c ON c.id = ci.collection_id
         LEFT JOIN collection_translations ct ON ct.collection_id = c.id AND ct.language_id = 'eng'
         WHERE ci.item_id IN (${itemPh})
           AND c.backward_compatibility LIKE 'mwnf3\\_thematic\\_gallery:thg\\_gallery:%'`,
        itemIds
      ),
      // Audio/video media attached to items (item_media table) — legacy
      // objects_video/monuments_video, already imported via ItemMediaImporter.
      this.db.query<ItemMediaRow>(
        `SELECT item_id, language_id, type, title, description, url
         FROM item_media
         WHERE item_id IN (${itemPh})
         ORDER BY item_id, display_order`,
        itemIds
      ),
      // Outgoing links only (source_id IN items). The legacy data model stores
      // directed links; fetching both directions and reversing doubles the list.
      // Justification texts are joined per link per language.
      this.db.query<ItemItemLinkRow>(
        `SELECT iil.source_id, iil.target_id,
                iilt.language_id, iilt.description AS justification
         FROM item_item_links iil
         LEFT JOIN item_item_link_translations iilt ON iilt.item_item_link_id = iil.id
         WHERE iil.source_id IN (${itemPh})`,
        itemIds
      ),
    ])

    // ── Build maps ───────────────────────────────────────────────────────────

    // item_id -> lang_code -> translation fields
    // Group rows by item_id+language first: an item can have more than one
    // context row for the same language (own project context + e.g. EPM).
    // These are combined, not merged with overwrite — the own-context row
    // supplies every field, and a second context's row (when present)
    // contributes only its description, as `short_description` (by
    // convention: the primary/own context holds the long description, a
    // secondary context like EPM holds the short one). See Epic 11 in the
    // islamicart parity backlog / memory `project_context_semantics`.
    const translationsByItemLang = new Map<string, ItemTranslationRow[]>()
    for (const t of translations) {
      const code = langCodeMap.get(t.language_id)
      if (!code) continue
      const key = `${t.item_id} ${code}`
      if (!translationsByItemLang.has(key)) translationsByItemLang.set(key, [])
      translationsByItemLang.get(key)!.push(t)
    }

    const translationMap = new Map<string, Record<string, Record<string, unknown>>>()
    for (const [key, rows] of translationsByItemLang) {
      const sep = key.indexOf(' ')
      const itemId = key.slice(0, sep)
      const code = key.slice(sep + 1)

      const ownContext = itemOwnContext.get(itemId)
      const ownRow =
        (ownContext ? rows.find(r => r.context_id === ownContext) : undefined) ?? rows[0]!
      const otherRow = rows.find(r => r !== ownRow)

      // Fields without a dedicated column live in item_translations.extra JSON.
      // Most keys are only ever set by the importer for the item type they
      // apply to (history/patrons/architects: monuments; workshop/scriber/
      // binding_desc/catalogue_holding_link/linkcatalogs: objects), so no type
      // gating is needed here. `copyright` is the exception — both transformers
      // write it — and it needs none either, for the same reason.
      const extra = ownRow.extra ? (parseJson(ownRow.extra) as Record<string, string> | null) : null

      if (!translationMap.has(itemId)) translationMap.set(itemId, {})
      translationMap.get(itemId)![code] = {
        name: ownRow.name,
        alternate_name: ownRow.alternate_name,
        description: ownRow.description,
        short_description: otherRow?.description ?? null,
        type: ownRow.type,
        holder: ownRow.holder,
        owner: ownRow.owner,
        initial_owner: ownRow.initial_owner,
        dates: ownRow.dates,
        location: ownRow.location,
        dimensions: ownRow.dimensions,
        place_of_production: ownRow.place_of_production,
        method_for_datation: ownRow.method_for_datation,
        method_for_provenance: ownRow.method_for_provenance,
        provenance: ownRow.provenance,
        obtention: ownRow.obtention,
        bibliography: ownRow.bibliography,
        history: extra?.history ?? null,
        patrons: extra?.patrons ?? null,
        architects: extra?.architects ?? null,
        workshop: extra?.workshop ?? null,
        scriber: extra?.scriber ?? null,
        binding_desc: extra?.binding_desc ?? null,
        // The item's rights statement ("Copyright image: <institution>"), which
        // legacy shows below the sheet. Not to be confused with the picture
        // `copyright` read further down — different record, per-image credit.
        copyright: extra?.copyright ?? null,
        catalogue_holding_link: extra?.catalogue_holding_link ?? null,
        linkcatalogs: extra?.linkcatalogs ?? null,
        author: ownRow.author_name,
        copy_editor: ownRow.copy_editor_name,
        translator: ownRow.translator_name,
        translation_copy_editor: ownRow.translation_copy_editor_name,
      }
    }

    // Write one translations/items.{lang}.json per language (null fields omitted)
    const byLang = new Map<string, Record<string, unknown>>()
    for (const [itemId, langMap] of translationMap) {
      for (const [langCode, fields] of Object.entries(langMap)) {
        if (!byLang.has(langCode)) byLang.set(langCode, {})
        byLang.get(langCode)![itemId] = this.stripNulls(fields)
      }
    }
    // Embedded detail texts ship in the same per-language files, keyed by the
    // detail's id — a consumer looks up parent.details[i].id in the loaded
    // language map to render the Special Features section.
    for (const [detailId, langMap] of detailTransMap) {
      for (const [langCode, fields] of Object.entries(langMap)) {
        if (!byLang.has(langCode)) byLang.set(langCode, {})
        byLang.get(langCode)![detailId] = this.stripNulls(fields)
      }
    }
    await this.writeTranslationFiles('items', byLang)

    // picture_id -> lang_code -> { caption, photographer, copyright }
    const picTransMap = new Map<
      string,
      Record<
        string,
        { caption: string | null; photographer: string | null; copyright: string | null }
      >
    >()
    for (const t of pictureTranslations) {
      if (!picTransMap.has(t.picture_id)) picTransMap.set(t.picture_id, {})
      const code = langCodeMap.get(t.language_id)
      if (!code) continue
      const extra = parseJson(t.extra) as Record<string, string> | null
      picTransMap.get(t.picture_id)![code] = {
        caption: t.caption,
        photographer: extra?.photographer ?? null,
        copyright: extra?.copyright ?? null,
      }
    }

    // item_id -> images[] (built from picture children)
    const imageMap = new Map<string, ImageEntry[]>()
    for (const pic of pictureItems) {
      if (!imageMap.has(pic.item_id)) imageMap.set(pic.item_id, [])
      const perLang = picTransMap.get(pic.picture_id) ?? {}

      // photographer/copyright are not language-specific; pick from first available lang
      const firstLang = Object.values(perLang)[0]

      // Captions keyed by lang code — skip langs with no caption text
      const captions: Record<string, string> = {}
      for (const [lang, t] of Object.entries(perLang)) {
        if (t.caption) captions[lang] = t.caption
      }

      imageMap.get(pic.item_id)!.push({
        url: this.imageUrl(pic.path),
        display_order: pic.display_order,
        captions,
        photographer: firstLang?.photographer ?? null,
        copyright: firstLang?.copyright ?? null,
      })
    }

    // item_id -> dynasty_ids[]
    const dynastyMap = new Map<string, string[]>()
    for (const link of dynastyLinks) {
      if (!dynastyMap.has(link.item_id)) dynastyMap.set(link.item_id, [])
      dynastyMap.get(link.item_id)!.push(link.dynasty_id)
    }

    // item_id -> tags[]
    const tagMap = new Map<string, string[]>()
    for (const link of tagLinks) {
      if (!tagMap.has(link.item_id)) tagMap.set(link.item_id, [])
      tagMap.get(link.item_id)!.push(link.tag)
    }

    // item_id -> glossary_ids[]
    const glossaryMap = new Map<string, string[]>()
    for (const link of glossaryLinks) {
      if (!glossaryMap.has(link.item_id)) glossaryMap.set(link.item_id, [])
      glossaryMap.get(link.item_id)!.push(link.glossary_id)
    }

    // item_id -> artist_names[]
    const artistMap = new Map<string, string[]>()
    for (const link of artistLinks) {
      if (!artistMap.has(link.item_id)) artistMap.set(link.item_id, [])
      artistMap.get(link.item_id)!.push(link.name)
    }

    // item_id -> thg_galleries[]
    const thgGalleryMap = new Map<string, { name: string }[]>()
    for (const row of thgGalleryLinks) {
      if (!thgGalleryMap.has(row.item_id)) thgGalleryMap.set(row.item_id, [])
      thgGalleryMap.get(row.item_id)!.push({ name: row.name ?? row.internal_name })
    }

    // item_id -> media[] (audio/video)
    const mediaMap = new Map<string, MediaEntry[]>()
    for (const m of mediaRows) {
      if (!mediaMap.has(m.item_id)) mediaMap.set(m.item_id, [])
      mediaMap.get(m.item_id)!.push({
        type: m.type,
        title: m.title,
        description: m.description,
        url: m.url,
        language: m.language_id ? (langCodeMap.get(m.language_id) ?? null) : null,
      })
    }

    // item_id -> related item entries (outgoing links only; only targets present in this export)
    // source_id -> target_id -> lang_code -> justification text
    const itemIdSet = new Set(itemIds)
    const relatedMap = new Map<string, string[]>()
    const justificationMap = new Map<string, Map<string, Record<string, string>>>()
    for (const link of itemItemLinks) {
      if (!itemIdSet.has(link.target_id)) continue
      if (!relatedMap.has(link.source_id)) relatedMap.set(link.source_id, [])
      const existing = relatedMap.get(link.source_id)!
      if (!existing.includes(link.target_id)) existing.push(link.target_id)

      const code = langCodeMap.get(link.language_id)
      if (code && link.justification) {
        if (!justificationMap.has(link.source_id)) justificationMap.set(link.source_id, new Map())
        const tgtMap = justificationMap.get(link.source_id)!
        if (!tgtMap.has(link.target_id)) tgtMap.set(link.target_id, {})
        tgtMap.get(link.target_id)![code] = link.justification
      }
    }

    // parent item_id -> embedded details[] entries
    const detailEntryMap = new Map<string, DetailEntry[]>()
    for (const [parentId, children] of detailsByParent) {
      detailEntryMap.set(
        parentId,
        children.map(d => ({
          id: d.id,
          internal_name: d.internal_name,
          backward_compatibility: d.backward_compatibility,
          display_order: d.display_order,
          images: imageMap.get(d.id) ?? [],
          artist_names: artistMap.get(d.id) ?? [],
          languages: Object.keys(detailTransMap.get(d.id) ?? {}).sort(),
        }))
      )
    }
    if (embeddedDetails.length > 0) {
      this.logger.info(
        `Embedded ${embeddedDetails.length} monument detail(s) on ${detailsByParent.size} parent item(s)`
      )
    }

    const output = items.map(item => ({
      id: item.id,
      type: item.type,
      internal_name: item.internal_name,
      backward_compatibility: item.backward_compatibility,
      parent_id: item.parent_id,
      partner_id: item.partner_id,
      country_id: item.country_id,
      project_id: item.project_id,
      owner_reference: item.owner_reference,
      mwnf_reference: item.mwnf_reference,
      start_date: item.start_date,
      end_date: item.end_date,
      latitude: item.latitude !== null ? parseFloat(item.latitude) : null,
      longitude: item.longitude !== null ? parseFloat(item.longitude) : null,
      images: imageMap.get(item.id) ?? [],
      dynasty_ids: dynastyMap.get(item.id) ?? [],
      related_items: (relatedMap.get(item.id) ?? []).map(targetId => ({
        id: targetId,
        justifications: justificationMap.get(item.id)?.get(targetId) ?? {},
      })),
      tags: tagMap.get(item.id) ?? [],
      glossary_ids: glossaryMap.get(item.id) ?? [],
      artist_names: artistMap.get(item.id) ?? [],
      thg_galleries: thgGalleryMap.get(item.id) ?? [],
      media: mediaMap.get(item.id) ?? [],
      details: detailEntryMap.get(item.id) ?? [],
      languages: Object.keys(translationMap.get(item.id) ?? {}).sort(),
    }))

    await this.writeJson('items.json', output)
    this.logger.success(`items.json (${output.length} items)`)

    return { file: 'items.json', count: output.length }
  }
}

interface ImageEntry {
  url: string
  display_order: number | null
  captions: Record<string, string>
  photographer: string | null
  copyright: string | null
}

/** A monument detail child item, before embedding on its parent. */
export interface DetailRow {
  id: string
  internal_name: string
  backward_compatibility: string | null
  parent_id: string | null
  display_order: number | null
}

interface DetailTranslationRow {
  item_id: string
  language_id: string
  context_id: string
  name: string
  description: string | null
  dates: string | null
  location: string | null
}

/** One embedded details[] entry on a parent item. */
interface DetailEntry {
  id: string
  internal_name: string
  backward_compatibility: string | null
  display_order: number | null
  images: ImageEntry[]
  artist_names: string[]
  languages: string[]
}

/**
 * Derives the parent monument's backward_compatibility key from a detail's:
 * mwnf3:monument_details:P:C:I:M:D → mwnf3:monuments:P:C:I:M.
 * Returns null when the key is not a monument_details key.
 */
export function parentKeyForDetail(detailKey: string | null): string | null {
  if (!detailKey) return null
  const parts = detailKey.split(':')
  if (parts.length !== 7 || parts[1] !== 'monument_details') return null
  return [parts[0], 'monuments', parts[2], parts[3], parts[4], parts[5]].join(':')
}

/**
 * Assigns each detail to a parent item present in the export. Resolution
 * order: the detail's own parent_id when it points at an exported item,
 * else the parent monument derived from the detail's backward_compatibility
 * key (recovers importer-side "Parent monument not found" rows whose parent
 * was imported later). Details resolving to neither are returned as orphans
 * — the caller must drop them, never export them parent-less.
 */
export function resolveDetailParents(
  details: DetailRow[],
  parents: { id: string; backward_compatibility: string | null }[]
): { byParent: Map<string, DetailRow[]>; orphans: DetailRow[]; recovered: DetailRow[] } {
  const parentIds = new Set(parents.map(p => p.id))
  const parentIdByKey = new Map(
    parents
      .filter(p => p.backward_compatibility !== null)
      .map(p => [p.backward_compatibility as string, p.id])
  )

  const byParent = new Map<string, DetailRow[]>()
  const orphans: DetailRow[] = []
  const recovered: DetailRow[] = []
  for (const detail of details) {
    let parentId =
      detail.parent_id !== null && parentIds.has(detail.parent_id) ? detail.parent_id : null
    if (parentId === null) {
      const parentKey = parentKeyForDetail(detail.backward_compatibility)
      const resolvedId = parentKey !== null ? parentIdByKey.get(parentKey) : undefined
      if (resolvedId !== undefined) {
        parentId = resolvedId
        recovered.push(detail)
      }
    }
    if (parentId === null) {
      orphans.push(detail)
      continue
    }
    if (!byParent.has(parentId)) byParent.set(parentId, [])
    byParent.get(parentId)!.push(detail)
  }
  return { byParent, orphans, recovered }
}

interface MediaEntry {
  type: string
  title: string
  description: string | null
  url: string
  language: string | null
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

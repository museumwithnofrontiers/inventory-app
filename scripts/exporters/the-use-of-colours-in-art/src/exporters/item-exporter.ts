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
  item_id: string
  display_order: number | null
  path: string
  alt_text: string | null
}

interface PictureTranslationRow {
  picture_id: string
  language_id: string
  caption: string | null
  extra: unknown
}

interface ItemTagRow {
  item_id: string
  tag_id: string
  category: string
  language_id: string
  description: string | null
  backward_compatibility: string
}

interface ItemDynastyRow {
  item_id: string
  dynasty_id: string
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

interface ItemItemLinkRow {
  source_id: string
  target_id: string
  target_backward_compatibility: string | null
  target_project_id: string | null
  language_id: string | null
  justification: string | null
}

interface ItemGalleryRow {
  item_id: string
  collection_id: string
  collection_type: string
  backward_compatibility: string
  internal_name: string
  title: string | null
  extra: unknown
}

/** The two mwnf3 tag families that are free text on the item sheet, not facets. */
const SHEET_TAG_CATEGORIES = ['keyword', 'material']

/**
 * `items.json` + `translations/items.<lang>.json`.
 *
 * Unlike the single-project exporters, the item universe here is the gallery's
 * membership union. Colours is the borrowed-majority case: only 24 of its 171
 * members are its own EXHCOLOUR records and 147 are borrowed — 39 AWE, 35 BAR,
 * 28 EPM, 22 ISL, 12 DCA, 6 GALLERIES, 2 DGA, and three Explore monuments that
 * carry no project key at all. So the source project printed on the sheet and
 * the context that selects a record's canonical translation are genuinely
 * per-item here, not a per-export constant with one exception.
 */
export class ItemExporter extends BaseExporter {
  getName(): string {
    return 'Items'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Exporting items.json...')

    if (this.memberItemIds.length === 0) {
      await this.writeJson('items.json', [])
      this.logger.warning('items.json (0 items)')
      return { file: 'items.json', count: 0 }
    }

    const itemPh = this.placeholders(this.memberItemIds.length)
    const langCodeMap = await this.buildLangCodeMap()

    const items = await this.db.query<ItemRow>(
      `SELECT id, type, internal_name, backward_compatibility, parent_id,
              partner_id, country_id, project_id,
              owner_reference, mwnf_reference, start_date, end_date,
              display_order, latitude, longitude
       FROM items
       WHERE id IN (${itemPh})
       ORDER BY type, display_order, internal_name`,
      this.memberItemIds
    )

    // EPM is not just another project: legacy stores the SHORT description in
    // `objects.description2`, and the importer files that text as a translation
    // in the EPM context (planTranslations in object-transformer.ts). So the EPM
    // context row is the item's short description no matter which project owns
    // the item — including EPM-native items, whose only row is that one.
    const epmContextId = await this.resolveEpmContextId()

    const [
      translations,
      pictureItems,
      tagLinks,
      dynastyLinks,
      glossaryLinks,
      artistLinks,
      mediaRows,
      itemItemLinks,
      galleryLinks,
    ] = await Promise.all([
      this.db.query<ItemTranslationRow>(
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
         WHERE it.item_id IN (${itemPh})`,
        this.memberItemIds
      ),
      this.db.query<PictureItemRow>(
        `SELECT pic.id AS picture_id, pic.parent_id AS item_id,
                pic.display_order, ii.path, ii.alt_text
         FROM items pic
         JOIN item_images ii ON ii.item_id = pic.id
         WHERE pic.type = 'picture'
           AND pic.parent_id IN (${itemPh})
         ORDER BY pic.parent_id, pic.display_order`,
        this.memberItemIds
      ),
      this.db.query<ItemTagRow>(
        `SELECT it.item_id, t.id AS tag_id, t.category, t.language_id,
                t.description, t.backward_compatibility
         FROM item_tag it
         JOIN tags t ON t.id = it.tag_id
         WHERE it.item_id IN (${itemPh})`,
        this.memberItemIds
      ),
      this.db.query<ItemDynastyRow>(
        `SELECT item_id, dynasty_id FROM item_dynasty WHERE item_id IN (${itemPh})`,
        this.memberItemIds
      ),
      this.db.query<ItemGlossaryRow>(
        `SELECT DISTINCT it.item_id, gs.glossary_id
         FROM item_translation_spelling its
         JOIN item_translations it ON it.id = its.item_translation_id
         JOIN glossary_spellings gs ON gs.id = its.spelling_id
         WHERE it.item_id IN (${itemPh})`,
        this.memberItemIds
      ),
      this.db.query<ItemArtistRow>(
        `SELECT ai.item_id, a.name
         FROM artist_item ai
         JOIN artists a ON a.id = ai.artist_id
         WHERE ai.item_id IN (${itemPh})`,
        this.memberItemIds
      ),
      this.db.query<ItemMediaRow>(
        `SELECT item_id, language_id, type, title, description, url
         FROM item_media
         WHERE item_id IN (${itemPh})
         ORDER BY item_id, display_order`,
        this.memberItemIds
      ),
      // Outgoing links only — the legacy model stores them directed, so reading
      // both directions and reversing would double the list. The target's own
      // identity is joined in because a related item is often OUTSIDE the
      // gallery and can then only be shipped as a reference (decision Q3).
      this.db.query<ItemItemLinkRow>(
        `SELECT iil.source_id, iil.target_id,
                tgt.backward_compatibility AS target_backward_compatibility,
                tgt.project_id AS target_project_id,
                iilt.language_id, iilt.description AS justification
         FROM item_item_links iil
         JOIN items tgt ON tgt.id = iil.target_id
         LEFT JOIN item_item_link_translations iilt ON iilt.item_item_link_id = iil.id
         WHERE iil.source_id IN (${itemPh})`,
        this.memberItemIds
      ),
      // "Also on display in" — the other thematic galleries and exhibitions that
      // feature this item. Legacy renders each as a link to that gallery's own
      // website; the package ships identity + metadata only (decision Q3).
      this.db.query<ItemGalleryRow>(
        `SELECT ci.item_id, c.id AS collection_id, c.type AS collection_type,
                c.backward_compatibility, c.internal_name, ct.title, c.extra
         FROM collection_item ci
         JOIN collections c ON c.id = ci.collection_id
         LEFT JOIN collection_translations ct
           ON ct.collection_id = c.id AND ct.language_id = 'eng'
         WHERE ci.item_id IN (${itemPh})
           AND c.backward_compatibility LIKE 'mwnf3\\_thematic\\_gallery:thg\\_gallery:%'`,
        this.memberItemIds
      ),
    ])

    const translationsByItemLang = new Map<string, ItemTranslationRow[]>()
    for (const row of translations) {
      const code = langCodeMap.get(row.language_id)
      if (!code) continue
      const key = `${row.item_id} ${code}`
      const bucket = translationsByItemLang.get(key)
      if (bucket) bucket.push(row)
      else translationsByItemLang.set(key, [row])
    }

    // item_id -> lang_code -> { category -> labels[] }, for the sheet's free-text
    // keyword and material lines. These tags ARE language-scoped (one row per
    // language), unlike the English-only THG facet tags.
    const sheetTags = new Map<string, Map<string, Map<string, string[]>>>()
    const facetTagIds = new Map<string, string[]>()
    for (const row of tagLinks) {
      if (row.backward_compatibility.includes('thg:tags:')) {
        const bucket = facetTagIds.get(row.item_id)
        if (bucket) {
          if (!bucket.includes(row.tag_id)) bucket.push(row.tag_id)
        } else {
          facetTagIds.set(row.item_id, [row.tag_id])
        }
        continue
      }
      if (!SHEET_TAG_CATEGORIES.includes(row.category)) continue
      const code = langCodeMap.get(row.language_id)
      const label = row.description
      if (!code || !label) continue

      let byLang = sheetTags.get(row.item_id)
      if (!byLang) {
        byLang = new Map()
        sheetTags.set(row.item_id, byLang)
      }
      let byCategory = byLang.get(code)
      if (!byCategory) {
        byCategory = new Map()
        byLang.set(code, byCategory)
      }
      const labels = byCategory.get(row.category)
      if (labels) labels.push(label)
      else byCategory.set(row.category, [label])
    }

    const translationMap = new Map<string, Record<string, Record<string, unknown>>>()
    for (const [key, rows] of translationsByItemLang) {
      const separator = key.indexOf(' ')
      const itemId = key.slice(0, separator)
      const code = key.slice(separator + 1)

      const ownContextId = this.context.itemOwnContextIds.get(itemId)
      const ownRow = (ownContextId ? rows.find(r => r.context_id === ownContextId) : undefined) ?? rows[0]!
      const epmRow = epmContextId ? rows.find(r => r.context_id === epmContextId) : undefined

      // For an EPM-native item the own row IS the EPM row, and its text is the
      // short description — legacy shows an empty long description there.
      const ownIsEpm = epmRow !== undefined && epmRow === ownRow
      const description = ownIsEpm ? null : ownRow.description
      const shortDescription = epmRow ? epmRow.description : null

      const extra = ownRow.extra ? (parseJson<Record<string, string>>(ownRow.extra) ?? null) : null
      const perCategory = sheetTags.get(itemId)?.get(code)

      const byLang = translationMap.get(itemId) ?? {}
      byLang[code] = {
        name: ownRow.name,
        alternate_name: ownRow.alternate_name,
        description,
        short_description: shortDescription,
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
        history: extra?.['history'] ?? null,
        patrons: extra?.['patrons'] ?? null,
        architects: extra?.['architects'] ?? null,
        workshop: extra?.['workshop'] ?? null,
        scriber: extra?.['scriber'] ?? null,
        binding_desc: extra?.['binding_desc'] ?? null,
        // The item's rights statement ("Copyright image: <institution>"), which
        // legacy shows below the sheet. Not to be confused with the picture
        // `copyright` read further down — different record, per-image credit.
        copyright: extra?.['copyright'] ?? null,
        catalogue_holding_link: extra?.['catalogue_holding_link'] ?? null,
        linkcatalogs: extra?.['linkcatalogs'] ?? null,
        author: ownRow.author_name,
        copy_editor: ownRow.copy_editor_name,
        translator: ownRow.translator_name,
        translation_copy_editor: ownRow.translation_copy_editor_name,
        keywords: perCategory?.get('keyword') ?? [],
        materials: perCategory?.get('material') ?? [],
      }
      translationMap.set(itemId, byLang)
    }

    const byLang = new Map<string, Record<string, unknown>>()
    for (const [itemId, langMap] of translationMap) {
      for (const [langCode, fields] of Object.entries(langMap)) {
        const bucket = byLang.get(langCode) ?? {}
        bucket[itemId] = this.stripNulls(fields)
        byLang.set(langCode, bucket)
      }
    }
    await this.writeTranslationFiles('items', byLang)

    const imageMap = await this.buildImageMap(pictureItems, langCodeMap)

    const dynastyMap = groupBy(dynastyLinks, r => r.item_id, r => r.dynasty_id)
    const glossaryMap = groupBy(glossaryLinks, r => r.item_id, r => r.glossary_id)
    const artistMap = groupBy(artistLinks, r => r.item_id, r => r.name)

    const mediaMap = new Map<string, unknown[]>()
    for (const row of mediaRows) {
      const entry = {
        type: row.type,
        title: row.title,
        description: row.description,
        url: row.url,
        language: row.language_id ? (langCodeMap.get(row.language_id) ?? null) : null,
      }
      const bucket = mediaMap.get(row.item_id)
      if (bucket) bucket.push(entry)
      else mediaMap.set(row.item_id, [entry])
    }

    const relatedMap = this.buildRelatedMap(itemItemLinks, langCodeMap)
    const galleryMap = this.buildGalleryMap(galleryLinks)

    const output = items.map(item => ({
      id: item.id,
      type: item.type,
      internal_name: item.internal_name,
      backward_compatibility: item.backward_compatibility,
      project_id: item.project_id,
      partner_id: item.partner_id,
      country_id: item.country_id,
      owner_reference: item.owner_reference,
      mwnf_reference: item.mwnf_reference,
      start_date: item.start_date,
      end_date: item.end_date,
      latitude: item.latitude !== null ? parseFloat(item.latitude) : null,
      longitude: item.longitude !== null ? parseFloat(item.longitude) : null,
      images: imageMap.get(item.id) ?? [],
      tag_ids: facetTagIds.get(item.id) ?? [],
      dynasty_ids: dynastyMap.get(item.id) ?? [],
      glossary_ids: glossaryMap.get(item.id) ?? [],
      artist_names: artistMap.get(item.id) ?? [],
      media: mediaMap.get(item.id) ?? [],
      related_items: relatedMap.get(item.id) ?? [],
      gallery_references: galleryMap.get(item.id) ?? [],
      languages: Object.keys(translationMap.get(item.id) ?? {}).sort(),
    }))

    await this.writeJson('items.json', output)
    this.logger.success(`items.json (${output.length} items, ${byLang.size} languages)`)

    return { file: 'items.json', count: output.length }
  }

  private async resolveEpmContextId(): Promise<string | null> {
    const rows = await this.db.query<{ id: string }>(
      `SELECT id FROM contexts WHERE backward_compatibility = ?`,
      ['mwnf3:projects:EPM']
    )
    return rows[0]?.id ?? null
  }

  private async buildImageMap(
    pictureItems: PictureItemRow[],
    langCodeMap: Map<string, string>
  ): Promise<Map<string, unknown[]>> {
    const imageMap = new Map<string, unknown[]>()
    if (pictureItems.length === 0) return imageMap

    const pictureIds = [...new Set(pictureItems.map(p => p.picture_id))]
    const pictureTranslations = await this.db.query<PictureTranslationRow>(
      `SELECT item_id AS picture_id, language_id, description AS caption, extra
       FROM item_translations
       WHERE item_id IN (${this.placeholders(pictureIds.length)})`,
      pictureIds
    )

    const byPicture = new Map<
      string,
      Record<string, { caption: string | null; photographer: string | null; copyright: string | null }>
    >()
    for (const row of pictureTranslations) {
      const code = langCodeMap.get(row.language_id)
      if (!code) continue
      const extra = parseJson<Record<string, string>>(row.extra)
      const bucket = byPicture.get(row.picture_id) ?? {}
      bucket[code] = {
        caption: row.caption,
        photographer: extra?.['photographer'] ?? null,
        copyright: extra?.['copyright'] ?? null,
      }
      byPicture.set(row.picture_id, bucket)
    }

    for (const picture of pictureItems) {
      const perLanguage = byPicture.get(picture.picture_id) ?? {}
      // photographer/copyright are not language-specific; take the first present.
      const first = Object.values(perLanguage)[0]

      const captions: Record<string, string> = {}
      for (const [language, fields] of Object.entries(perLanguage)) {
        if (fields.caption) captions[language] = fields.caption
      }

      const entry = {
        url: this.imageUrl(picture.path),
        display_order: picture.display_order,
        alt_text: picture.alt_text,
        captions,
        photographer: first?.photographer ?? null,
        copyright: first?.copyright ?? null,
      }
      const bucket = imageMap.get(picture.item_id)
      if (bucket) bucket.push(entry)
      else imageMap.set(picture.item_id, [entry])
    }

    return imageMap
  }

  /**
   * Related items, kept whole.
   *
   * A gallery's members are borrowed, so plenty of their legacy relations point
   * at items outside the gallery. Dropping those would silently lose content the
   * legacy sheet shows, so every link is exported with `in_package` saying
   * whether the viewer can link to it locally; the rest carry the identity a
   * resolver will need later (decision Q3).
   */
  private buildRelatedMap(
    links: ItemItemLinkRow[],
    langCodeMap: Map<string, string>
  ): Map<string, unknown[]> {
    const memberIds = new Set(this.memberItemIds)
    const bySource = new Map<string, Map<string, RelatedEntry>>()

    for (const link of links) {
      let byTarget = bySource.get(link.source_id)
      if (!byTarget) {
        byTarget = new Map()
        bySource.set(link.source_id, byTarget)
      }

      let entry = byTarget.get(link.target_id)
      if (!entry) {
        entry = {
          id: link.target_id,
          backward_compatibility: link.target_backward_compatibility,
          project_id: link.target_project_id,
          in_package: memberIds.has(link.target_id),
          justifications: {},
        }
        byTarget.set(link.target_id, entry)
      }

      const code = link.language_id ? langCodeMap.get(link.language_id) : undefined
      if (code && link.justification) entry.justifications[code] = link.justification
    }

    const result = new Map<string, unknown[]>()
    for (const [sourceId, byTarget] of bySource) {
      result.set(sourceId, [...byTarget.values()])
    }
    return result
  }

  /** The other thematic galleries/exhibitions featuring an item, as references. */
  private buildGalleryMap(rows: ItemGalleryRow[]): Map<string, unknown[]> {
    const result = new Map<string, unknown[]>()
    for (const row of rows) {
      if (row.collection_id === this.exhibition.id) continue
      const anchor =
        parseJson<{ thg_gallery?: Record<string, unknown> }>(row.extra)?.thg_gallery ?? {}
      const entry = {
        id: row.collection_id,
        backward_compatibility: row.backward_compatibility,
        kind: row.collection_type,
        slug: (anchor['slug'] as string | undefined) ?? null,
        legacy_host: (anchor['host'] as string | undefined) ?? null,
        name: row.title ?? row.internal_name,
      }
      const bucket = result.get(row.item_id)
      if (bucket) bucket.push(entry)
      else result.set(row.item_id, [entry])
    }
    return result
  }
}

interface RelatedEntry {
  id: string
  backward_compatibility: string | null
  project_id: string | null
  in_package: boolean
  justifications: Record<string, string>
}

function groupBy<T, V>(rows: T[], key: (row: T) => string, value: (row: T) => V): Map<string, V[]> {
  const result = new Map<string, V[]>()
  for (const row of rows) {
    const k = key(row)
    const bucket = result.get(k)
    if (bucket) bucket.push(value(row))
    else result.set(k, [value(row)])
  }
  return result
}


/**
 * Parses a MySQL JSON column value. mysql2 auto-decodes native JSON columns
 * into JS objects already, so `raw` is usually an object/array, not a string
 * — only fall back to JSON.parse for the (defensive) string case.
 */
function parseJson<T>(raw: unknown): T | null {
  if (raw == null) return null
  if (typeof raw === 'object') return raw as T
  try {
    return JSON.parse(raw as string) as T
  } catch {
    return null
  }
}

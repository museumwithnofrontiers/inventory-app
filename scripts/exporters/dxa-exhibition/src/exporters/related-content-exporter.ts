import type { ExportResult } from '../core/types.js'
import { BaseExporter } from './base-exporter.js'

interface RelatedContentRow {
  id: string
  language_id: string | null
  title: string | null
  description: string | null
  url: string | null
  display_order: number | null
  extra: unknown
  backward_compatibility: string | null
}

interface RelatedContentExtra {
  category_id?: number
  authors?: string
  type_resource?: string
  further_reading?: string
  entity_country?: string
  entity_location?: string
}

/**
 * `related_content.json` — the categorized reading list on `/related`.
 *
 * Legacy's `exhibition_related_content` is a base table plus an `_i18n` table,
 * and the importer files BOTH into `collection_media`:
 *
 *   mwnf3_thematic_gallery:exhibition_related_content:<id>:<kind>            (language_id NULL)
 *   mwnf3_thematic_gallery:exhibition_related_content_i18n:<id>:<lang>:<kind>
 *
 * so a link that has an English row appears twice. Exporting the table as-is
 * ships 14 entries where the site shows 10, with four visible duplicates. The
 * fix is to group by the legacy `<id>` and let the translated rows win, falling
 * back to the base row only for an id that was never translated — which is what
 * legacy's own join does.
 *
 * Three more things the shape has to respect:
 *
 * - **Not every entry has something to link to.** An entry can be a
 *   bibliography and nothing else — no link, no document, no title, no type.
 *   Those cannot live in `collection_media` (its `url` is required), so the
 *   importer writes them to the exhibition collection's `extra.further_readings`
 *   and this exporter folds them back into the same array with `kind: "text"`
 *   and a per-language `texts` map. `kind` is what the page switches on.
 *
 * - **Documents and links are not the same field.** The `<kind>` suffix says
 *   which: a `:document` row's `url` is a path on the legacy media server
 *   (never imported, so the viewer supplies the host, like the other chrome
 *   images), while a `:link` row's `url` is an absolute external address. They
 *   ship as `document_path` and `url` respectively rather than as one
 *   ambiguous column.
 *
 * - **Category labels are UI strings, not data.** Legacy resolves `category_id`
 *   to "Further Reading" / "Related MWNF Content" / "Related Partner Content" /
 *   "Other Related Content" from a table that was never imported. Per the
 *   package's third design principle those belong in `scripts/site-i18n`, so
 *   the package ships the stable numeric id and the site names it.
 */
export class RelatedContentExporter extends BaseExporter {
  getName(): string {
    return 'Related content'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Exporting related_content.json...')

    const rows = await this.db.query<RelatedContentRow>(
      `SELECT id, language_id, title, description, url, display_order, extra,
              backward_compatibility
       FROM collection_media
       WHERE collection_id = ?
         AND backward_compatibility LIKE 'mwnf3\\_thematic\\_gallery:exhibition\\_related\\_content%'
       ORDER BY display_order, backward_compatibility`,
      [this.exhibition.id]
    )

    const langCodeMap = await this.buildLangCodeMap()

    // legacy related-content id → the rows describing it, translated or not.
    const grouped = new Map<string, RelatedContentRow[]>()
    for (const row of rows) {
      const key = relatedContentLegacyId(row.backward_compatibility)
      if (!key) {
        this.logger.warning(
          `related_content.json: unparseable key, dropped: ${row.backward_compatibility}`
        )
        continue
      }
      const bucket = grouped.get(key)
      if (bucket) bucket.push(row)
      else grouped.set(key, [row])
    }

    let duplicatesCollapsed = 0
    const output: unknown[] = []

    for (const [legacyId, entries] of grouped) {
      const translated = entries.filter(row => row.language_id !== null)
      const chosen = translated.length > 0 ? translated : entries
      duplicatesCollapsed += entries.length - chosen.length

      const anchor = chosen[0]!
      const extra = parseJson<RelatedContentExtra>(anchor.extra) ?? {}
      const kind = relatedContentKind(anchor.backward_compatibility)

      const titles: Record<string, string> = {}
      const descriptions: Record<string, string> = {}
      for (const row of chosen) {
        const code = row.language_id ? langCodeMap.get(row.language_id) : null
        // An untranslated base row still has a title; key it under the
        // exhibition's own default rather than dropping the text.
        const bucketKey = code ?? 'und'
        if (row.title) titles[bucketKey] = row.title
        if (row.description) descriptions[bucketKey] = row.description
      }

      output.push(
        this.stripNulls({
          legacy_id: legacyId,
          category_id: extra.category_id ?? null,
          kind,
          display_order: anchor.display_order ?? 0,
          url: kind === 'link' ? anchor.url : null,
          // Legacy-hosted PDF: a path, not an absolute URL — same convention as
          // the chrome images in exhibition.json.
          document_path: kind === 'document' ? anchor.url : null,
          titles,
          descriptions,
          authors: extra.authors ?? null,
          type_resource: extra.type_resource ?? null,
          further_reading: extra.further_reading ?? null,
          entity_country: extra.entity_country ?? null,
          entity_location: extra.entity_location ?? null,
        })
      )
    }

    output.push(...(await this.loadFurtherReadings(langCodeMap)))

    if (output.length === 0) {
      await this.writeJson('related_content.json', [])
      this.logger.warning('related_content.json (0 entries)')
      return { file: 'related_content.json', count: 0 }
    }

    output.sort((a, b) => {
      const left = a as { category_id: number | null; display_order: number }
      const right = b as { category_id: number | null; display_order: number }
      return (left.category_id ?? 0) - (right.category_id ?? 0) ||
        left.display_order - right.display_order
    })

    await this.writeJson('related_content.json', output)
    this.logger.success(
      `related_content.json (${output.length} entries` +
        (duplicatesCollapsed > 0
          ? `, ${duplicatesCollapsed} untranslated duplicate row(s) collapsed)`
          : ')')
    )

    return { file: 'related_content.json', count: output.length }
  }

  /**
   * The "Further Reading" blocks — related-content entries that carry a
   * bibliography and nothing else. They have no `collection_media` row because
   * that table needs a URL, so the importer files them on the exhibition
   * collection's `extra` instead (museumwithnofrontiers/inventory-app#1607 territory: the
   * same read-modify-write the gallery anchor and hidden-museum list use).
   *
   * They ship in the same array as the linked entries, with `kind: "text"` and
   * no `url`/`document_path`, so the page renders one ordered list.
   */
  private async loadFurtherReadings(langCodeMap: Map<string, string>): Promise<unknown[]> {
    const rows = await this.db.query<{ extra: unknown }>(
      `SELECT extra FROM collections WHERE id = ?`,
      [this.exhibition.id]
    )
    const extra = parseJson<{ further_readings?: LegacyFurtherReading[] }>(rows[0]?.extra)
    const entries = extra?.further_readings
    if (!Array.isArray(entries)) return []

    return entries.map(entry => furtherReadingEntry(entry, langCodeMap)).filter(e => e !== null)
  }
}

/** `collections.extra.further_readings[]`, as the importer writes it. */
export interface LegacyFurtherReading {
  legacy_id: number
  category_id: number | null
  display_order: number
  texts: Record<string, string>
}

/**
 * One `collections.extra.further_readings` entry in package shape.
 *
 * The `texts` map is rekeyed from the inventory language id the importer writes
 * ('eng') to the ISO-639-1 code the rest of the package uses ('en'), the same
 * translation every other per-language map in this exporter gets. An entry
 * whose languages all fail that lookup carries nothing renderable and is
 * dropped rather than shipped as an empty block.
 */
export function furtherReadingEntry(
  entry: LegacyFurtherReading,
  langCodeMap: Map<string, string>
): Record<string, unknown> | null {
  const texts: Record<string, string> = {}
  for (const [languageId, text] of Object.entries(entry?.texts ?? {})) {
    const code = langCodeMap.get(languageId)
    if (code && text) texts[code] = text
  }
  if (Object.keys(texts).length === 0) return null

  return {
    legacy_id: String(entry.legacy_id),
    category_id: entry.category_id ?? null,
    kind: 'text',
    display_order: entry.display_order ?? 0,
    // The whole entry is this text, keyed by language code — there is no title,
    // no author and nothing to link to.
    texts,
  }
}

/**
 * The legacy `exhibition_related_content.related_content_id` from either
 * keyspace — `…:exhibition_related_content:6:link` and
 * `…:exhibition_related_content_i18n:6:en:link` are both entry 6, which is the
 * whole point of parsing it rather than grouping on the full key.
 */
export function relatedContentLegacyId(backwardCompatibility: string | null): string | null {
  if (!backwardCompatibility) return null
  const segments = backwardCompatibility.split(':')
  if (segments[1] !== 'exhibition_related_content' && segments[1] !== 'exhibition_related_content_i18n') {
    return null
  }
  return segments[2] ?? null
}

/** `link` or `document` — the last segment of either keyspace. */
export function relatedContentKind(backwardCompatibility: string | null): 'link' | 'document' | null {
  if (!backwardCompatibility) return null
  const last = backwardCompatibility.split(':').pop()
  return last === 'link' || last === 'document' ? last : null
}

function parseJson<T>(raw: unknown): T | null {
  if (raw == null) return null
  if (typeof raw === 'object') return raw as T
  try {
    return JSON.parse(raw as string) as T
  } catch {
    return null
  }
}

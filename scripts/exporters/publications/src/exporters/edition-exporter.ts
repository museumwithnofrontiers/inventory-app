import type { ExportResult } from '../core/types.js'
import { BaseExporter, parseJson } from './base-exporter.js'
import { isServableDocument, toDocument, toImage, type DocumentRow, type ImageRow } from './publication-exporter.js'

interface EditionRow {
  id: string
  publication_id: string
  language_id: string
  format: string
  edition: number | null
  publish_year: number | null
  isbn: string | null
  publisher: string | null
  page_count: number | null
  image_count: number | null
  plan_count: number | null
  dimensions: string | null
  binding: string | null
  display_order: number | null
  backward_compatibility: string | null
  extra: unknown
}

/**
 * An edition's own texts, when they differ from its publication's
 * (`extra.legacy_texts`, D-P9). The edition's shop links (`extra.shop_links`)
 * are never exported (D-P8).
 */
export function editionTexts(extra: unknown): Record<string, unknown> | null {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return null
  const texts = (extra as Record<string, unknown>)['legacy_texts']
  return texts && typeof texts === 'object' && !Array.isArray(texts) ? (texts as Record<string, unknown>) : null
}

/**
 * editions.json: per publication, each version legacy shows (one language ×
 * publisher × format × edition): its format, edition, year, ISBN,
 * publisher, counts, dimensions and binding as printed, its cover rendition,
 * its sample and credits PDFs, and its own texts where they differ from the
 * publication's. A version legacy hides (`visible` false) is left out.
 */
export class EditionExporter extends BaseExporter {
  getName(): string {
    return 'Editions'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Exporting editions.json...')
    const ids = this.scope.publicationIds
    if (ids.length === 0) {
      await this.writeJson('editions.json', [])
      return { file: 'editions.json', count: 0 }
    }
    const ph = this.placeholders(ids.length)
    const langCodeMap = await this.buildLangCodeMap()

    const [editions, covers, documents] = await Promise.all([
      this.db.query<EditionRow>(
        `SELECT id, publication_id, language_id, format, edition, publish_year, isbn, publisher,
                page_count, image_count, plan_count, dimensions, binding, display_order,
                backward_compatibility, extra
         FROM publication_editions
         WHERE publication_id IN (${ph}) AND visible = 1`,
        ids
      ),
      this.db.query<ImageRow>(
        `SELECT publication_id, publication_edition_id, kind, path, alt_text, display_order, extra
         FROM publication_images
         WHERE publication_id IN (${ph}) AND kind = 'cover' AND publication_edition_id IS NOT NULL
         ORDER BY publication_edition_id, display_order, path`,
        ids
      ),
      this.db.query<DocumentRow>(
        `SELECT id, publication_id, publication_edition_id, language_id, kind, path
         FROM publication_documents
         -- A document whose file never synced keeps the size placeholder 1 (legacy
         -- names files that do not exist): /doc has nothing to serve for it.
         WHERE publication_id IN (${ph}) AND publication_edition_id IS NOT NULL AND size <> 1
         ORDER BY publication_edition_id, display_order, kind, id`,
        ids
      ),
    ])

    const order = new Map(ids.map((id, index) => [id, index]))
    editions.sort(
      (a, b) =>
        order.get(a.publication_id)! - order.get(b.publication_id)! ||
        (a.display_order ?? Number.MAX_SAFE_INTEGER) - (b.display_order ?? Number.MAX_SAFE_INTEGER) ||
        (a.language_id < b.language_id ? -1 : a.language_id > b.language_id ? 1 : 0) ||
        (a.edition ?? 0) - (b.edition ?? 0) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    )

    const output = editions.map(e => {
      const cover = covers.find(c => c.publication_edition_id === e.id)
      return {
        id: e.id,
        publication_id: e.publication_id,
        backward_compatibility: e.backward_compatibility,
        language: langCodeMap.get(e.language_id) ?? null,
        format: e.format,
        edition: e.edition,
        publish_year: e.publish_year,
        isbn: e.isbn,
        publisher: e.publisher,
        page_count: e.page_count,
        image_count: e.image_count,
        plan_count: e.plan_count,
        dimensions: e.dimensions,
        binding: e.binding,
        display_order: e.display_order,
        cover: cover ? toImage(cover, path => this.imageUrl(path)) : null,
        documents: documents
          .filter(d => d.publication_edition_id === e.id && isServableDocument(d.path))
          .map(d => toDocument(d, langCodeMap, path => this.documentUrl(path))),
        texts: editionTexts(parseJson(e.extra)),
      }
    })

    await this.writeJson('editions.json', output)
    this.logger.success(`editions.json (${output.length} editions)`)
    return { file: 'editions.json', count: output.length }
  }
}
